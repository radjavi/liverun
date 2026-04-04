import Foundation
import Combine
import SwiftUI
import WatchKit
import HealthKit
import CoreLocation
import CoreMotion
import UserNotifications

struct RunSummary {
    let duration: TimeInterval
    let distanceMeters: Double
    let avgPace: Double
    let cheerCount: Int
}

struct CheerEntry: Identifiable {
    let id = UUID()
    let count: Int
    let message: String
    let receivedAt: Date
}

class WorkoutManager: NSObject, ObservableObject {
    @Published var isRunning = false
    @Published var isPaused = false
    @Published var showSummary = false
    @Published var startDate: Date?
    @Published var heartRate: Double = 0
    @Published var pace: Double = 0
    @Published var distanceMeters: Double = 0
    @Published var cadence: Double = 0
    @Published var altitude: Double = 0
    @Published var gradeAdjustedPace: Double = 0
    @Published var cheers: [CheerEntry] = []
    var summaryData: RunSummary?

    private let healthStore = HKHealthStore()
    private let locationManager = CLLocationManager()
    private let pedometer = CMPedometer()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var routeBuilder: HKWorkoutRouteBuilder?
    private let trackingService = TrackingService()
    var bearerToken: String?

    private var runId: String?
    private var runName: String?
    private var runRaceId: String?
    private var isPlannedRun = false
    private var previousLocation: CLLocation?
    private var lastCheerShownDate = Date.distantPast
    private var isRetryingCreateRun = false
    private var pendingPoints: [PendingPoint] = []
    private var pausedDuration: TimeInterval = 0
    private var pauseStartDate: Date?
    private var pauseStartLocation: CLLocation?
    @Published var showResumePrompt = false

    private struct PendingPoint {
        let location: CLLocation
        let heartRate: Double?
        let pace: Double?
        let distanceMeters: Double?
        let cadence: Double?
        let gradeAdjustedPace: Double?
        let paused: Bool
    }

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 3
        locationManager.activityType = .fitness
        locationManager.allowsBackgroundLocationUpdates = true
    }

    func elapsedTime(at date: Date) -> TimeInterval {
        guard let start = startDate else { return 0 }
        let total = date.timeIntervalSince(start)
        let currentPause = pauseStartDate.map { date.timeIntervalSince($0) } ?? 0
        return total - pausedDuration - currentPause
    }

    func start() {
        requestPermissions { [weak self] in
            self?.beginWorkout()
        }
    }

    func startPlanned(runId: String, name: String?, raceId: String?) {
        self.runId = runId
        self.runName = name
        self.runRaceId = raceId
        self.isPlannedRun = true
        requestPermissions { [weak self] in
            self?.beginWorkout()
        }
    }

    func togglePause() {
        if isPaused {
            resume()
        } else {
            pause()
        }
    }

    func pause() {
        guard !isPaused else { return }
        session?.pause()
        pedometer.stopUpdates()
        pauseStartDate = Date()
        pauseStartLocation = previousLocation
        isPaused = true
        WKInterfaceDevice.current().play(.click)
    }

    func resume() {
        guard isPaused else { return }
        session?.resume()
        if let start = startDate {
            startPedometerUpdates(from: start)
        }
        if let pauseStart = pauseStartDate {
            pausedDuration += Date().timeIntervalSince(pauseStart)
            pauseStartDate = nil
        }
        pauseStartLocation = nil
        showResumePrompt = false
        isPaused = false
        WKInterfaceDevice.current().play(.click)
    }

    func dismissResumePrompt() {
        showResumePrompt = false
        pauseStartLocation = previousLocation
    }

    func stop() {
        locationManager.stopUpdatingLocation()
        pedometer.stopUpdates()

        let shouldSave = distanceMeters >= 50
        let now = Date()

        session?.end()

        if shouldSave {
            builder?.endCollection(withEnd: now) { [weak self] _, _ in
                self?.builder?.finishWorkout { workout, _ in
                    guard let workout = workout else { return }
                    self?.routeBuilder?.finishRoute(with: workout, metadata: nil) { _, _ in }
                }
            }
        } else {
            builder?.discardWorkout()
        }

        Task {
            if let runId = runId {
                await trackingService.flushWithRetry()
                await trackingService.endRunWithRetry(runId: runId, endedAt: now)
            }
        }

        let elapsed = elapsedTime(at: Date())
        summaryData = RunSummary(
            duration: elapsed,
            distanceMeters: distanceMeters,
            avgPace: distanceMeters > 0 ? (elapsed / 60) / (distanceMeters / 1000) : 0,
            cheerCount: cheers.count
        )

        isRunning = false
        isPaused = false
        showSummary = true
        previousLocation = nil
    }

    func dismissSummary() {
        showSummary = false
        summaryData = nil
        heartRate = 0
        pace = 0
        distanceMeters = 0
        cadence = 0
        altitude = 0
        gradeAdjustedPace = 0
        cheers = []
        startDate = nil
        runId = nil
        runName = nil
        runRaceId = nil
        isPlannedRun = false
        pendingPoints = []
        isRetryingCreateRun = false
        pausedDuration = 0
        pauseStartDate = nil
        pauseStartLocation = nil
        showResumePrompt = false
    }

    private func requestPermissions(completion: @escaping () -> Void) {
        let typesToShare: Set<HKSampleType> = [
            HKObjectType.workoutType(),
            HKSeriesType.workoutRoute()
        ]
        let typesToRead: Set<HKObjectType> = [
            HKObjectType.quantityType(forIdentifier: .heartRate)!,
            HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning)!
        ]

        healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead) { success, _ in
            if success {
                DispatchQueue.main.async { completion() }
            }
        }

        locationManager.requestWhenInUseAuthorization()
    }

    private func beginWorkout() {
        let config = HKWorkoutConfiguration()
        config.activityType = .running
        config.locationType = .outdoor

        do {
            session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            builder = session?.associatedWorkoutBuilder()
            builder?.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)

            session?.delegate = self
            builder?.delegate = self

            let now = Date()
            self.startDate = now
            session?.startActivity(with: now)
            builder?.beginCollection(withStart: now) { _, _ in }

            routeBuilder = HKWorkoutRouteBuilder(healthStore: healthStore, device: nil)
            locationManager.startUpdatingLocation()
            startPedometerUpdates(from: now)
            requestNotificationPermission()
            isRunning = true

            Task {
                await trackingService.configure(token: bearerToken)
                if isPlannedRun, let id = runId {
                    await trackingService.startRun(runId: id, startedAt: now)
                }
            }
        } catch {
            print("Failed to start workout: \(error)")
        }
    }
    // MARK: - Cheers

    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    private func handleCheerUpdate(_ update: CheerUpdate) {
        guard let highlight = update.highlight else { return }

        cheers.insert(CheerEntry(count: update.count, message: highlight.message, receivedAt: Date()), at: 0)

        guard Date().timeIntervalSince(lastCheerShownDate) >= 5 else { return }
        lastCheerShownDate = Date()

        let content = UNMutableNotificationContent()
        content.title = "\(update.count) cheer\(update.count == 1 ? "" : "s") for you!"
        content.body = highlight.message
        content.sound = nil

        let request = UNNotificationRequest(
            identifier: "cheer-\(highlight.id)",
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(request)
        WKInterfaceDevice.current().play(.directionUp)
    }

    // MARK: - Pedometer

    private func startPedometerUpdates(from start: Date) {
        guard CMPedometer.isCadenceAvailable() else { return }
        pedometer.startUpdates(from: start) { [weak self] data, _ in
            guard let data = data, let currentCadence = data.currentCadence else { return }
            // CMPedometer reports cadence in steps/second, convert to steps/minute
            let spm = currentCadence.doubleValue * 60.0
            DispatchQueue.main.async {
                self?.cadence = spm
            }
        }
    }

    // MARK: - Grade Adjusted Pace (Minetti cost-of-transport)

    /// Calculates GAP using the Minetti et al. (2002) polynomial for the metabolic cost of running on a grade.
    /// grade: fractional slope (e.g. 0.05 = 5%)
    /// Returns a cost factor relative to flat running. GAP = actual_pace / cost_factor.
    private static func gapCostFactor(grade: Double) -> Double {
        let i = grade
        // Minetti polynomial: C = 155.4i^5 - 30.4i^4 - 43.3i^3 + 46.3i^2 + 19.5i + 3.6
        let cost = 155.4 * pow(i, 5) - 30.4 * pow(i, 4) - 43.3 * pow(i, 3) + 46.3 * pow(i, 2) + 19.5 * i + 3.6
        let flatCost: Double = 3.6 // cost at grade 0
        let factor = cost / flatCost
        // Clamp to avoid extreme values from GPS noise
        return max(factor, 0.5)
    }

    private func updateGAP(from previous: CLLocation, to current: CLLocation) {
        let altitudeDelta = current.altitude - previous.altitude
        let horizontalDistance = current.distance(from: previous)
        guard horizontalDistance > 1.0, pace > 0 else { return }

        let grade = altitudeDelta / horizontalDistance
        let costFactor = Self.gapCostFactor(grade: grade)
        gradeAdjustedPace = pace / costFactor
    }
}

// MARK: - CLLocationManagerDelegate
extension WorkoutManager: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let currentlyPaused = isPaused
        let capturedPoints = locations.map { location in
            PendingPoint(
                location: location,
                heartRate: heartRate > 0 ? heartRate : nil,
                pace: pace > 0 ? pace : nil,
                distanceMeters: distanceMeters > 0 ? distanceMeters : nil,
                cadence: cadence > 0 ? cadence : nil,
                gradeAdjustedPace: gradeAdjustedPace > 0 ? gradeAdjustedPace : nil,
                paused: currentlyPaused
            )
        }

        routeBuilder?.insertRouteData(locations) { _, _ in }

        for location in locations {
            altitude = location.altitude
            if let prev = previousLocation {
                updateGAP(from: prev, to: location)
            }
            previousLocation = location
        }

        if isPaused {
            // Check if user started moving
            if let origin = pauseStartLocation, let latest = locations.last {
                let distance = latest.distance(from: origin)
                if distance > 30 && !showResumePrompt {
                    showResumePrompt = true
                    WKInterfaceDevice.current().play(.notification)
                }
            }
        }

        if runId == nil {
            pendingPoints.append(contentsOf: capturedPoints)
            retryCreateRun()
            return
        }

        enqueuePoints(capturedPoints)
    }

    private func retryCreateRun() {
        guard !isRetryingCreateRun else { return }
        isRetryingCreateRun = true

        if isPlannedRun, let existingId = runId {
            // Planned run: update startedAt on the existing run
            Task {
                await trackingService.configure(token: bearerToken)
                await trackingService.startRun(runId: existingId, startedAt: startDate ?? Date())
                await MainActor.run {
                    self.isRetryingCreateRun = false
                    self.drainPendingPoints()
                }
            }
        } else {
            Task {
                let id = await trackingService.createRun(
                    startedAt: startDate,
                    name: runName,
                    raceId: runRaceId
                )
                await MainActor.run {
                    self.isRetryingCreateRun = false
                    if let id = id {
                        self.runId = id
                        self.drainPendingPoints()
                    }
                }
            }
        }
    }

    private func drainPendingPoints() {
        let points = pendingPoints
        pendingPoints.removeAll()
        guard let runId = runId else { return }
        Task {
            for p in points {
                await trackingService.bufferPoint(TrackingPoint(
                    runId: runId,
                    latitude: p.location.coordinate.latitude,
                    longitude: p.location.coordinate.longitude,
                    altitude: p.location.altitude,
                    heartRate: p.heartRate,
                    pace: p.pace,
                    distanceMeters: p.distanceMeters,
                    cadence: p.cadence,
                    gradeAdjustedPace: p.gradeAdjustedPace,
                    paused: p.paused,
                    recordedAt: p.location.timestamp
                ))
            }
            await trackingService.flush()
        }
    }

    private func enqueuePoints(_ points: [PendingPoint]) {
        guard let runId = runId else { return }
        for p in points {
            let point = TrackingPoint(
                runId: runId,
                latitude: p.location.coordinate.latitude,
                longitude: p.location.coordinate.longitude,
                altitude: p.location.altitude,
                heartRate: p.heartRate,
                pace: p.pace,
                distanceMeters: p.distanceMeters,
                cadence: p.cadence,
                gradeAdjustedPace: p.gradeAdjustedPace,
                paused: p.paused,
                recordedAt: p.location.timestamp
            )
            Task {
                if let cheerUpdate = await trackingService.enqueue(point) {
                    await MainActor.run { self.handleCheerUpdate(cheerUpdate) }
                }
            }
        }
    }
}

// MARK: - HKWorkoutSessionDelegate
extension WorkoutManager: HKWorkoutSessionDelegate {
    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {
        DispatchQueue.main.async {
            switch toState {
            case .paused:
                if !self.isPaused {
                    self.pedometer.stopUpdates()
                    self.pauseStartDate = Date()
                    self.pauseStartLocation = self.previousLocation
                    self.isPaused = true
                    WKInterfaceDevice.current().play(.click)
                }
            case .running where fromState == .paused:
                if self.isPaused {
                    if let start = self.startDate {
                        self.startPedometerUpdates(from: start)
                    }
                    if let pauseStart = self.pauseStartDate {
                        self.pausedDuration += Date().timeIntervalSince(pauseStart)
                        self.pauseStartDate = nil
                    }
                    self.pauseStartLocation = nil
                    self.showResumePrompt = false
                    self.isPaused = false
                    WKInterfaceDevice.current().play(.click)
                }
            default:
                break
            }
        }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        print("Workout session failed: \(error)")
    }
}

// MARK: - HKLiveWorkoutBuilderDelegate
extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType else { continue }

            let statistics = workoutBuilder.statistics(for: quantityType)

            DispatchQueue.main.async {
                switch quantityType {
                case HKQuantityType.quantityType(forIdentifier: .heartRate):
                    let hr = statistics?.mostRecentQuantity()?.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
                    self.heartRate = hr ?? 0

                case HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning):
                    let dist = statistics?.sumQuantity()?.doubleValue(for: .meter())
                    self.distanceMeters = dist ?? 0

                    // Calculate pace from elapsed time and distance
                    if let dist = dist, dist > 0,
                       let startDate = workoutBuilder.startDate {
                        let elapsed = Date().timeIntervalSince(startDate)
                        let minPerKm = (elapsed / 60) / (dist / 1000)
                        self.pace = minPerKm
                    }

                default:
                    break
                }
            }
        }
    }
}

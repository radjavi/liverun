import Foundation
import Combine
import SwiftUI
import WatchKit
import HealthKit
import CoreLocation
import CoreMotion
import UserNotifications

struct CheerEntry: Identifiable {
    let id = UUID()
    let count: Int
    let message: String
    let receivedAt: Date
}

class WorkoutManager: NSObject, ObservableObject {
    @Published var isRunning = false
    @Published var startDate: Date?
    @Published var heartRate: Double = 0
    @Published var pace: Double = 0
    @Published var distanceMeters: Double = 0
    @Published var cadence: Double = 0
    @Published var altitude: Double = 0
    @Published var gradeAdjustedPace: Double = 0
    @Published var cheers: [CheerEntry] = []

    private let healthStore = HKHealthStore()
    private let locationManager = CLLocationManager()
    private let pedometer = CMPedometer()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var routeBuilder: HKWorkoutRouteBuilder?
    private let trackingService = TrackingService()

    private var runId: String?
    private var previousLocation: CLLocation?
    private var lastCheerShownDate = Date.distantPast

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 3
        locationManager.activityType = .fitness
        locationManager.allowsBackgroundLocationUpdates = true
    }

    func start() {
        requestPermissions { [weak self] in
            self?.beginWorkout()
        }
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
                await trackingService.flush()
                await trackingService.endRun(runId: runId)
            }
        }

        isRunning = false
        previousLocation = nil
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
                if let id = await trackingService.createRun() {
                    await MainActor.run { self.runId = id }
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
        guard let runId = runId else { return }

        routeBuilder?.insertRouteData(locations) { _, _ in }

        for location in locations {
            altitude = location.altitude
            if let prev = previousLocation {
                updateGAP(from: prev, to: location)
            }
            previousLocation = location

            let point = TrackingPoint(
                runId: runId,
                latitude: location.coordinate.latitude,
                longitude: location.coordinate.longitude,
                altitude: location.altitude,
                heartRate: heartRate > 0 ? heartRate : nil,
                pace: pace > 0 ? pace : nil,
                distanceMeters: distanceMeters > 0 ? distanceMeters : nil,
                cadence: cadence > 0 ? cadence : nil,
                gradeAdjustedPace: gradeAdjustedPace > 0 ? gradeAdjustedPace : nil,
                recordedAt: location.timestamp
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
    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {}

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

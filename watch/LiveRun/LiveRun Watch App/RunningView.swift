import SwiftUI

struct RunningView: View {
    @ObservedObject var workoutManager: WorkoutManager
    @Binding var selectedTab: Int

    private let units = UnitSystem.current

    var body: some View {
        TabView(selection: $selectedTab) {
            // Swipe left: Mute, Pause & Stop buttons
            VStack(spacing: 4) {
                Button {
                    workoutManager.notificationsMuted.toggle()
                } label: {
                    HStack {
                        Image(systemName: workoutManager.notificationsMuted ? "bell.slash.fill" : "bell.fill")
                            .font(.system(size: 14))
                        Text(workoutManager.notificationsMuted ? "Muted" : "Mute")
                            .font(.system(size: 16, weight: .semibold, design: .monospaced))
                    }
                    .foregroundColor(workoutManager.notificationsMuted ? .secondary : .white)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.white.opacity(workoutManager.notificationsMuted ? 0.08 : 0.15))
                    .cornerRadius(8)
                }
                .buttonStyle(.plain)
                Button {
                    workoutManager.togglePause()
                } label: {
                    HStack {
                        Image(systemName: workoutManager.isPaused ? "play.fill" : "pause.fill")
                            .font(.system(size: 14))
                        Text(workoutManager.isPaused ? "Resume" : "Pause")
                            .font(.system(size: 16, weight: .semibold, design: .monospaced))
                    }
                    .foregroundColor(primaryColor)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(primaryColor.opacity(0.15))
                    .cornerRadius(8)
                }
                .buttonStyle(.plain)
                Button {
                    workoutManager.stop()
                } label: {
                    HStack {
                        Image(systemName: "stop.fill")
                            .font(.system(size: 14))
                        Text("Stop")
                            .font(.system(size: 16, weight: .semibold, design: .monospaced))
                    }
                    .foregroundColor(.red)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.red.opacity(0.15))
                    .cornerRadius(8)
                }
                .buttonStyle(.plain)
            }
            .padding()
            .tag(0)

            // Main page: Stats + Race layout (crown scrolls vertically)
            TabView {
                VStack(alignment: .leading, spacing: 6) {
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        let elapsed = workoutManager.elapsedTime(at: context.date)
                        StatRow(label: "TIME", value: formatDuration(elapsed), unit: "")
                    }
                    StatRow(label: "HEART RATE", value: workoutManager.heartRate > 0 ? "\(Int(workoutManager.heartRate))" : "\u{2014}", unit: "bpm")
                    StatRow(label: "PACE", value: workoutManager.pace > 0 ? formatPaceCompact(units.pace(minPerKm: workoutManager.pace)) : "\u{2014}", unit: units.paceUnit)
                    StatRow(label: "DISTANCE", value: String(format: "%.2f", units.distance(meters: workoutManager.distanceMeters)), unit: units.distanceUnit)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(.horizontal)

                raceLayoutView
            }
            .tabViewStyle(.verticalPage)
            .tag(1)

            // Swipe right: Cheers
            VStack(alignment: .leading) {
                Text("CHEERS")
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .tracking(1.5)
                    .foregroundColor(.secondary)
                    .padding(.horizontal)

                if workoutManager.cheers.isEmpty {
                    Spacer()
                    Text("No cheers yet")
                        .font(.system(size: 14, design: .monospaced))
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity)
                    Spacer()
                } else {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 8) {
                            ForEach(workoutManager.cheers) { cheer in
                                HStack(spacing: 4) {
                                    Text(cheer.message)
                                        .font(.system(size: 14, design: .monospaced))
                                    if cheer.count > 1 {
                                        Text("+\(cheer.count - 1) more")
                                            .font(.system(size: 11, design: .monospaced))
                                            .foregroundColor(.secondary)
                                    }
                                }
                            }
                        }
                        .padding(.horizontal)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .padding(.top, -10)
            .tag(2)
        }
        .tabViewStyle(.page)
        .alert("Still running?", isPresented: $workoutManager.showResumePrompt) {
            Button("Resume") {
                workoutManager.resume()
                selectedTab = 1
            }
            Button("Stay Paused", role: .cancel) {
                workoutManager.dismissResumePrompt()
            }
        } message: {
            Text("It looks like you're moving. Resume to keep tracking.")
        }
    }

    private var raceLayoutView: some View {
        VStack(spacing: 0) {
            // Top: distance
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(String(format: "%.2f", units.distance(meters: workoutManager.distanceMeters)))
                    .font(.system(size: 22, weight: .semibold, design: .monospaced).monospacedDigit())
                Text(units.distanceUnit)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 4)

            Spacer(minLength: 0)

            // Middle: total avg pace (left) and current lap pace (right)
            HStack(alignment: .top, spacing: 8) {
                paceColumn(
                    label: "AVG",
                    pace: workoutManager.pace,
                    alignment: .leading
                )
                paceColumn(
                    label: "LAP",
                    pace: workoutManager.currentLapPace,
                    alignment: .trailing
                )
            }

            Spacer(minLength: 0)

            // Bottom: activity time
            TimelineView(.periodic(from: .now, by: 1)) { context in
                let elapsed = workoutManager.elapsedTime(at: context.date)
                Text(formatDuration(elapsed))
                    .font(.system(size: 18, design: .monospaced).monospacedDigit())
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.bottom, 4)
        }
        .padding(.horizontal)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func paceColumn(label: String, pace: Double, alignment: HorizontalAlignment) -> some View {
        VStack(alignment: alignment, spacing: 2) {
            Text(label)
                .font(.system(size: 10, weight: .medium, design: .monospaced))
                .tracking(1.5)
                .foregroundColor(.secondary)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(pace > 0 ? formatPaceCompact(units.pace(minPerKm: pace)) : "\u{2014}")
                    .font(.system(size: 24, weight: .semibold, design: .monospaced).monospacedDigit())
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                if pace > 0 {
                    Text(units.paceUnit)
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundColor(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .trailing)
    }

    private func formatDuration(_ seconds: TimeInterval) -> String {
        let h = Int(seconds) / 3600
        let m = (Int(seconds) % 3600) / 60
        let s = Int(seconds) % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, s)
        }
        return String(format: "%02d:%02d", m, s)
    }

    private func formatPaceCompact(_ minPerKm: Double) -> String {
        let mins = Int(minPerKm)
        let secs = Int((minPerKm - Double(mins)) * 60)
        return String(format: "%d:%02d", mins, secs)
    }
}

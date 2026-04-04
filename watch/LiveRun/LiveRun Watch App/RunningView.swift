import SwiftUI

struct RunningView: View {
    @ObservedObject var workoutManager: WorkoutManager
    @Binding var selectedTab: Int

    private let units = UnitSystem.current

    var body: some View {
        TabView(selection: $selectedTab) {
            // Swipe left: Pause & Stop buttons
            VStack(spacing: 4) {
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

            // Main page: Stats
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

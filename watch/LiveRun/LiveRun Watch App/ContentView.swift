import SwiftUI
import Combine

struct PlannedRun: Codable, Identifiable {
    let id: String
    let name: String?
    let raceId: String?
    let plannedStartTime: Date
}

@MainActor
class PlannedRunsManager: ObservableObject {
    @Published var plannedRuns: [PlannedRun] = []
    private let baseURL = Config.apiBaseURL

    func fetch(token: String?) async {
        guard let url = URL(string: "\(baseURL)/api/planned-runs"),
              let token = token else { return }
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .custom { decoder in
                let container = try decoder.singleValueContainer()
                let str = try container.decode(String.self)
                let f1 = ISO8601DateFormatter()
                f1.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                if let date = f1.date(from: str) { return date }
                let f2 = ISO8601DateFormatter()
                f2.formatOptions = [.withInternetDateTime]
                if let date = f2.date(from: str) { return date }
                throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid date: \(str)")
            }
            plannedRuns = try decoder.decode([PlannedRun].self, from: data)
        } catch {
            print("Failed to fetch planned runs: \(error)")
        }
    }
}

private func formatPlannedTime(_ date: Date) -> String {
    let calendar = Calendar.current
    let formatter = DateFormatter()
    formatter.dateFormat = "HH:mm"
    let time = formatter.string(from: date)

    if calendar.isDateInToday(date) {
        return "Today \(time)"
    } else if calendar.isDateInTomorrow(date) {
        return "Tomorrow \(time)"
    } else {
        let dayFormatter = DateFormatter()
        dayFormatter.dateFormat = "MMM d, HH:mm"
        return dayFormatter.string(from: date)
    }
}

struct ContentView: View {
    @StateObject private var workoutManager = WorkoutManager()
    @StateObject private var authManager = AuthManager()
    @StateObject private var plannedRunsManager = PlannedRunsManager()
    @State private var selectedTab = 1

    var body: some View {
        Group {
            if !authManager.isAuthenticated {
                DeviceAuthView(authManager: authManager)
            } else if workoutManager.showSummary, let summary = workoutManager.summaryData {
                SummaryView(summary: summary) {
                    workoutManager.dismissSummary()
                }
            } else if workoutManager.isRunning {
                RunningView(workoutManager: workoutManager, selectedTab: $selectedTab)
            } else {
                HomeView(
                    authManager: authManager,
                    workoutManager: workoutManager,
                    plannedRunsManager: plannedRunsManager,
                    selectedTab: $selectedTab
                )
            }
        }
        .onChange(of: workoutManager.isRunning) { selectedTab = 1 }
        .onChange(of: authManager.isAuthenticated) { selectedTab = 1 }
    }
}

struct HomeView: View {
    @ObservedObject var authManager: AuthManager
    @ObservedObject var workoutManager: WorkoutManager
    @ObservedObject var plannedRunsManager: PlannedRunsManager
    @Binding var selectedTab: Int

    var body: some View {
        TabView(selection: $selectedTab) {
            ProfileView(authManager: authManager)
                .tag(0)

            List {
                ForEach(plannedRunsManager.plannedRuns) { planned in
                    Button {
                        workoutManager.bearerToken = authManager.bearerToken
                        workoutManager.startPlanned(
                            runId: planned.id,
                            name: planned.name,
                            raceId: planned.raceId
                        )
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(planned.name ?? "Outdoor Run")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(.white)
                                Text(formatPlannedTime(planned.plannedStartTime))
                                    .font(.system(size: 13))
                                    .foregroundColor(primaryColor)
                            }
                            Spacer()
                            Image(systemName: "calendar.badge.clock")
                                .font(.system(size: 24))
                                .foregroundColor(primaryColor)
                        }
                        .padding(.vertical, 4)
                    }
                }

                Button {
                    workoutManager.bearerToken = authManager.bearerToken
                    workoutManager.start()
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Outdoor Run")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(.white)
                            Text("Start New")
                                .font(.system(size: 13))
                                .foregroundColor(.gray)
                        }
                        Spacer()
                        Image(systemName: "figure.run")
                            .font(.system(size: 24))
                            .foregroundColor(primaryColor)
                    }
                    .padding(.vertical, 4)
                }
            }
            .listStyle(.carousel)
            .tag(1)
            .onAppear {
                Task {
                    await plannedRunsManager.fetch(token: authManager.bearerToken)
                }
            }
        }
        .tabViewStyle(.page)
    }
}

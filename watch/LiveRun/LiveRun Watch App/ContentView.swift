import SwiftUI

struct ContentView: View {
    @StateObject private var workoutManager = WorkoutManager()
    @StateObject private var authManager = AuthManager()
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
    @Binding var selectedTab: Int

    var body: some View {
        TabView(selection: $selectedTab) {
            ProfileView(authManager: authManager)
                .tag(0)

            List {
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
        }
        .tabViewStyle(.page)
    }
}

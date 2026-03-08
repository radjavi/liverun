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

            VStack {
                Spacer()
                VStack(spacing: 6) {
                    Image(systemName: "figure.run")
                        .font(.system(size: 32))
                        .foregroundColor(primaryColor)
                    Text("Outdoor Run")
                        .font(.system(size: 14, weight: .medium, design: .monospaced))
                        .foregroundColor(.white)
                }
                Spacer()
                Spacer()
                Button {
                    workoutManager.bearerToken = authManager.bearerToken
                    workoutManager.start()
                } label: {
                    Image(systemName: "play.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(primaryColor)
                        .cornerRadius(8)
                }
                .buttonStyle(.plain)
            }
            .padding()
            .tag(1)
        }
        .tabViewStyle(.page)
    }
}

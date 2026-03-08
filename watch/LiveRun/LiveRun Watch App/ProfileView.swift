import SwiftUI

struct ProfileView: View {
    @ObservedObject var authManager: AuthManager

    var body: some View {
        VStack(spacing: 6) {
            Text(authManager.displayName ?? "")
                .font(.system(size: 18, weight: .bold, design: .monospaced))

            if let username = authManager.username {
                Text("@\(username)")
                    .font(.system(size: 14, design: .monospaced))
                    .foregroundColor(.secondary)
            }

            Spacer()

            DestructiveButton(title: "Sign Out") {
                authManager.signOut()
            }
        }
        .padding()
    }
}

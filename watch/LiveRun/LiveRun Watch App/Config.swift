import Foundation

enum Config {
    static let apiBaseURL: String = {
        guard let value = Bundle.main.infoDictionary?["API_BASE_URL"] as? String else {
            fatalError("API_BASE_URL not set in Info.plist")
        }
        return value
    }()
}

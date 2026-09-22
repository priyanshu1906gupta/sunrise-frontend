import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()
        ScreenshotShield.install(on: window)

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

enum ScreenshotShield {
    static func install(on window: UIWindow?) {
        guard let window else { return }
        let field = UITextField()
        field.isSecureTextEntry = true
        field.isUserInteractionEnabled = false
        window.addSubview(field)
        window.layer.superlayer?.addSublayer(field.layer)
        field.layer.sublayers?.last?.addSublayer(window.layer)
    }
}

//
//  CredentialsBridge.swift
//  DataAtHand
//
//  Created by Mateo Landry on 9/26/20.
//  Copyright © 2020 Facebook. All rights reserved.
//

import Foundation

public class Credentials : NSObject {
  @objc public static func getBugsnagApiKey() -> String? {
    return JSONFiles.apiKey
  }
}


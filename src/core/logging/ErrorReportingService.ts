import { Platform } from "react-native"

let bugsnagClient: any = null

export interface ErrorReport {
    context?: string,
    errorClass?: string,
    errorMessage?: string,
    groupingHash?: string,
    severity?: 'warning' | 'error' | 'info'
    metadata?: any
}

export function initErrorReportingService() {
    //if (__DEV__ === false) {
        try {
            const bugsnagInfo = require("@credentials/bugsnag.json")
            if (bugsnagInfo != null && bugsnagInfo.api_key != null && bugsnagInfo.api_key.length > 0 && __DEV__ != true) {
                bugsnagClient = require('@bugsnag/react-native')
                bugsnagClient.start()
            }
        } catch (ex) {
            console.log(ex)
        }
    //}
}

export function notifyError(error: Error, before?: (report: ErrorReport) => void) {
    if (bugsnagClient != null) {
        bugsnagClient.notify(error, before)
    }
}
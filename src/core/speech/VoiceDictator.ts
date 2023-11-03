import { Platform } from "react-native";
import { DictationResult, IVoiceDictatorNative } from "./types";

export class VoiceDictator {

    private static _instance: VoiceDictator
    static get instance(): VoiceDictator {
        if (this._instance == null) {
            this._instance = new VoiceDictator()
        }

        return this._instance
    }

    private voiceDictatorNative: IVoiceDictatorNative

    private constructor() {
        this.voiceDictatorNative = Platform.OS === 'ios' ? new (require("./IOSDictatorImpl").IOSDictatorImpl)() : new (require("./AndroidMicrosoftDictatorImpl").AndroidMicrosoftDictatorImpl)()
    }

    private startEventListener: () => void = null
    private receivedEventListener: (result: DictationResult) => void = null
    private stopEventListener: (error: any) => void = null

    async install(): Promise<boolean> {
        const installed = await this.voiceDictatorNative.install()

        if (installed === true) {

            this.voiceDictatorNative.registerReceivedEventListener((received) => {
                if (this.receivedEventListener) {
                    this.receivedEventListener(received)
                }
            })

            this.voiceDictatorNative.registerStartEventListener(() => {
                if (this.startEventListener) {
                    this.startEventListener()
                }
            })

            this.voiceDictatorNative.registerStopEventListener((error: any) => {
                if (this.stopEventListener) {
                    this.stopEventListener(error)
                }
            })

            return true
        } else {
            return false
        }
    }

    async uninstall(): Promise<boolean> {
        return this.voiceDictatorNative.uninstall()
    }

    clearAllListeners() {
        this.startEventListener = null
        this.stopEventListener = null
        this.receivedEventListener = null
    }

    isAvailableInSystem(): Promise<boolean> {
        return this.voiceDictatorNative.isAvailableInSystem()
    }

    registerStartEventListener(listener: () => void) {
        this.startEventListener = listener
    }
    registerReceivedEventListener(listener: (result: DictationResult) => void) {
        this.receivedEventListener = listener
    }
    registerStopEventListener(listener: (error: any) => void) {
        this.stopEventListener = listener
    }

    async start(): Promise<boolean> {
        console.log("Start voice dictator.")
        const started = await this.voiceDictatorNative.start()
        if (started === true) {
            return true
        } else {
            return false
        }
    }
    async stop(): Promise<boolean> {
        const stopped = await this.voiceDictatorNative.stop()
        if (stopped === true) {
            return true
        } else {
            return false
        }
    }

}
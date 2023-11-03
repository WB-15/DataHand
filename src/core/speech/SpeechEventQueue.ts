import { Subject, Observable } from "rxjs"
import { NLUResultType, NLUResult } from "@data-at-hand/core/speech/types"

export interface SpeechNotificationEvent{
    type: NLUResultType,
    nluResult: NLUResult,
    id: string
}

export class SpeechEventQueue{
    
    private static _instance: SpeechEventQueue = null

    public static get instance(): SpeechEventQueue{
        if(this._instance == null){
            this._instance = new SpeechEventQueue()
        }
        return this._instance
    }
    
    private constructor(){

    }

    private _onNewEventPushed = new Subject<SpeechNotificationEvent>()

    public get onNewEventPushed(): Observable<SpeechNotificationEvent>{
        return this._onNewEventPushed
    }

    public push(event: SpeechNotificationEvent){
        console.log("Push new speech notification event")
        this._onNewEventPushed.next(event)
    }
}
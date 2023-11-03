import { DateTimeHelper } from "@data-at-hand/core/utils/time";
import { startOfMonth, startOfYear, endOfMonth, endOfYear, getYear, isAfter, subYears } from "date-fns";
import { mergeChronoOptions } from "./chrono-merge";
import { Chrono, ParsedResult } from 'chrono-node';
import chronoParserApi from 'chrono-node/src/parsers/parser';
import chronoRefinerApi from 'chrono-node/src/refiners/refiner';

import chronoOptions from 'chrono-node/src/options';
import { HOLIDAY_PARSERS } from "./chrono-holidays";
import { CHRONO_EXTENSION_PARSERS, CHRONO_EXTENSION_REFINERS } from "./chrono-extension";
import { makeWeekdayParser } from "./chrono-replacers/chrono-weekdays";
import NamedRegExp from "named-regexp-groups";
import { makeMonthNameParser } from "./chrono-replacers/chrono-monthnames";
import { makeRelativeDateFormatParser } from "./chrono-replacers/chrono-relative";
import { makeNoopParser } from "./chrono-replacers/chrono-noop";
import { VariableType } from "@data-at-hand/core/speech/types";
import { makeENMergeDateRangeRefiner } from "./chrono-replacers/chrono-mergedates";
import { NLUOptions } from "../types";
import { CHRONO_TAG_RANGE_CERTAIN } from "@core/speech/types";


let _chrono: Chrono | undefined = undefined
export function getChrono(): Chrono {
    if (_chrono == null) {

        chronoParserApi.findYearClosestToRef = function (ref, day, month) {
            let date = new Date(getYear(ref), month - 1, day)
            while (isAfter(date, ref) === true) {
                date = subYears(date, 1)
            }
            return getYear(date)
        }

        chronoParserApi.ENWeekdayParser = makeWeekdayParser
        chronoParserApi.ENMonthNameParser = makeMonthNameParser
        chronoParserApi.ENRelativeDateFormatParser = makeRelativeDateFormatParser

        //Noop
        chronoParserApi.ENTimeExpressionParser = makeNoopParser
        chronoParserApi.ENMonthNameLittleEndianParser = makeNoopParser

        chronoParserApi.ENTimeLaterFormatParser = makeNoopParser
        //

        chronoRefinerApi.ENMergeDateRangeRefiner = makeENMergeDateRangeRefiner

        //initialize chrono
        const options = mergeChronoOptions([
            chronoOptions.en.casual,
        ]);

        HOLIDAY_PARSERS.concat(CHRONO_EXTENSION_PARSERS).forEach(parser => {
            options.parsers.push(parser)
        })

        CHRONO_EXTENSION_REFINERS.forEach(refiner => {
            options.refiners.push(refiner)
        })

        _chrono = new Chrono(options)
    }
    return _chrono
}

type TimeVariable = {
    type: VariableType.Date | VariableType.Period,
    value: number | [number, number],
    index: number,
    text: string,
    additionalInfo?: any
}

export function extractTimeExpressions(speech: string, ref: Date, options: NLUOptions): Array<TimeVariable>{
    const chronoParseResult = getChrono().parse(speech, ref, options)
    console.log(chronoParseResult)
    return chronoParseResult.map(result => processChronoResult(result)).filter(r => r != null)
}

function processChronoResult(chronoResult: ParsedResult): TimeVariable {
    if (chronoResult.end) {
        //period
        let startDate: Date | undefined
        if (chronoResult.start.isCertain('day')) {
            startDate = chronoResult.start.date()
        } else if (chronoResult.start.isCertain('month')) {
            startDate = startOfMonth(chronoResult.start.date())
        } else if (chronoResult.start.isCertain('year')) {
            startDate = startOfYear(chronoResult.start.date())
        } else startDate = chronoResult.start.date()

        let endDate: Date | undefined
        if (chronoResult.end.isCertain('day')) {
            endDate = chronoResult.end.date()
        } else if (chronoResult.end.isCertain('month')) {
            endDate = endOfMonth(chronoResult.end.date())
        } else if (chronoResult.end.isCertain('year')) {
            endDate = endOfYear(chronoResult.end.date())
        } else endDate = chronoResult.end.date()

        if (startDate != null && endDate != null) {
            const start = DateTimeHelper.toNumberedDateFromDate(startDate)
            const end = DateTimeHelper.toNumberedDateFromDate(endDate)
            return {
                type: VariableType.Period,
                value: [Math.min(start, end), Math.max(start, end)],
                text: chronoResult.text,
                index: chronoResult.index,
                additionalInfo: {
                    "isPeriodCertain": chronoResult.tags[CHRONO_TAG_RANGE_CERTAIN],
                    "conjunctionTo": chronoResult.tags["ConjunctionTo"],
                    "beforeConjunction": chronoResult.tags["BeforeConjunction"],
                    "afterConjunction": chronoResult.tags["AfterConjunction"]
                }
            }
        } else return null

    } else {
        if (chronoResult.start.isCertain('day')) {
            return {
                type: VariableType.Date,
                value: DateTimeHelper.toNumberedDateFromDate(chronoResult.start.date()),
                text: chronoResult.text,
                index: chronoResult.index,
                additionalInfo: chronoResult.tags["Preposition"]
            }
        } else if (chronoResult.start.isCertain('month')) {
            const date = chronoResult.start.date()
            return {
                type: VariableType.Period,
                value: [DateTimeHelper.toNumberedDateFromDate(startOfMonth(date)), DateTimeHelper.toNumberedDateFromDate(endOfMonth(date))],
                text: chronoResult.text,
                index: chronoResult.index
            }
        } else if (chronoResult.start.isCertain('year')) {
            const date = chronoResult.start.date()
            return {
                type: VariableType.Period,
                value: [DateTimeHelper.toNumberedDateFromDate(startOfYear(date)), DateTimeHelper.toNumberedDateFromDate(endOfYear(date))],
                text: chronoResult.text,
                index: chronoResult.index
            }
        } else if (chronoResult.start.knownValues.weekday != null) {
            const date = chronoResult.start.date()
            return {
                type: VariableType.Date,
                value: DateTimeHelper.toNumberedDateFromDate(date),
                text: chronoResult.text,
                index: chronoResult.index,
                additionalInfo: chronoResult.tags["Preposition"]
            }
        }
    }
}

export function parseDateTextToNumberedDate(text: string, today: Date): number | null {
    const chronoResult: ParsedResult[] = getChrono().parse(text, today)
    if (chronoResult.length > 0) {
        const bestResult = chronoResult[0]
        if (bestResult.start.isCertain('day')) {
            const date = bestResult.start.date()
            return DateTimeHelper.toNumberedDateFromDate(date)
        } else return null
    }
    return null
}



const quarterhalfpattern = new NamedRegExp("((?<number>[0-9])\\s+)?(and\\s+)?(a\\s+)?(?<ratio>half|quarter|1/2|1/4)\\s+(?<unit>day|hour|minute|second)", "i");

export function parseDurationTextToSeconds(text: string): number {

    const matched = text.match(quarterhalfpattern)
    if (matched) {
        try {
            let digit = 0
            if (matched.groups.number != null) {
                digit = Number.parseInt(matched.groups.number)
            }

            switch (matched.groups.ratio) {
                case 'half':
                case '1/2':
                    digit += 0.5
                    break;
                case 'quarter':
                case '1/4':
                    digit += 0.25
                    break;
            }

            switch (matched.groups.unit) {
                case 'day':
                    return digit * 24 * 3600
                case 'minute':
                    return digit * 60
                case 'hour':
                default:
                    return digit * 3600
            }
        } catch (e) {
            console.log("duration parsing error - ", text, ": ", e)
        }
    }

    var parse = require('parse-duration')
    const parsedByLibrary = parse(text)
    return Math.round(parsedByLibrary / 1000);
}

/*
["10 hours", "4 and a half hours", "5 hours and 30 minutes", "4 and a quarter hours", "4 1/2 hours"].forEach(test => {
    console.log(test, ":", parseDurationTextToSeconds(test));
})*/

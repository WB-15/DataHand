import React, { useCallback } from 'react';
import { IAggregatedRangeValue } from "@core/exploration/data/types";
import { View, LayoutRectangle, ViewStyle } from "react-native";
import { SizeWatcher } from "@components/visualization/SizeWatcher";
import { useState } from "react";
import { StyleTemplates } from "@style/Styles";
import { scaleBand, scaleLinear } from "d3-scale";
import { min, max } from "d3-array";
import { G } from "react-native-svg";
import { Sizes } from '@style/Sizes';
import { getDomainAndTickFormat, makeTouchingInfoForCycle } from './common';
import { CycleChartFrame } from './CycleChartFrame';
import { RangeValueElement } from './RangeValueElement';
import { RangeValueElementLegend } from './RangeValueElementLegend';
import { useDispatch } from 'react-redux';
import { createGoToCyclicDetailDailyAction, createGoToCyclicDetailRangeAction, setTouchElementInfo } from '@state/exploration/interaction/actions';
import { CyclicTimeFrame, getCycleDimensionWithTimeKey, getCycleLevelOfDimension } from '@data-at-hand/core/exploration/CyclicTimeFrame';
import { DataSourceType } from '@data-at-hand/core/measure/DataSourceSpec';
import { InteractionType } from '@data-at-hand/core/exploration/actions';


const xAxisHeight = 100
const yAxisWidth = 60
const topPadding = 20
const rightPadding = 20

const legendContainerStyle = { alignItems: 'flex-end', padding: Sizes.horizontalPadding, paddingLeft: 0, paddingRight: 0 } as ViewStyle

export const RangeValueCyclicChart = (props: {
    values: Array<IAggregatedRangeValue>,
    dataSource: DataSourceType,
    cycleType: CyclicTimeFrame,
    preferredValueRange?: [number, number],
    yTickFormat?: (num: number) => string,
    startFromZero?: boolean,
    ticksOverride?: (min: number, max: number) => number[],
    rangeALabel: string,
    rangeBLabel: string,
}) => {

    const [chartContainerWidth, setChartContainerWidth] = useState(-1)
    const [chartContainerHeight, setChartContainerHeight] = useState(-1)


    const chartArea: LayoutRectangle = {
        x: yAxisWidth,
        y: topPadding,
        width: chartContainerWidth - yAxisWidth - rightPadding,
        height: chartContainerHeight - xAxisHeight - topPadding
    }

    const { domain, tickFormat } = getDomainAndTickFormat(props.cycleType)
    const dispatch = useDispatch()

    const scaleX = scaleBand<number>().domain(domain).range([0, chartArea.width]).padding(0.35)

    let scaleY = scaleLinear()
        .domain([props.startFromZero === true ? 0 :
            Math.min(min(props.values, v => (v.minA))!, min(props.values, v => (v.minB))!, (props.preferredValueRange ? props.preferredValueRange[0] : Number.MAX_VALUE)),
        Math.max(max(props.values, v => (v.maxA))!, max(props.values, v => (v.maxB))!, (props.preferredValueRange ? props.preferredValueRange[1] : Number.MIN_VALUE))])
        .range([0, chartArea.height]).nice()

    let ticks
    if (props.ticksOverride) {
        ticks = props.ticksOverride(scaleY.domain()[0], scaleY.domain()[1])
        scaleY = scaleY.domain([ticks[0], ticks[ticks.length - 1]])
    }

    const onClickElement = useCallback((timeKey: number) => {
        const dimension = getCycleDimensionWithTimeKey(props.cycleType, timeKey)
        if (getCycleLevelOfDimension(dimension) === 'day') {
            dispatch(createGoToCyclicDetailDailyAction(InteractionType.TouchOnly, undefined, undefined, dimension))
        } else {
            dispatch(createGoToCyclicDetailRangeAction(InteractionType.TouchOnly, undefined, undefined, dimension))
        }
    }, [props.cycleType])

    const onLongPress = useCallback((timeKey, x, y, screenX, screenY, touchId) => {
        dispatch(setTouchElementInfo(makeTouchingInfoForCycle(timeKey,
            props.dataSource,
            props.cycleType,
            scaleX, chartArea, x, y, screenX, screenY, touchId, (timeKey) => {
                return props.values.find(v => v.timeKey === timeKey)
            })))
    }, [props.dataSource, props.cycleType, scaleX, chartArea, props.values])

    const onLongPressOut = useCallback(() => {
        dispatch(setTouchElementInfo(null))
    }, [])

    return <View style={StyleTemplates.fillFlex}>
        <View style={legendContainerStyle}>
            <RangeValueElementLegend rangeALabel={props.rangeALabel} rangeBLabel={props.rangeBLabel} />
        </View>
        <SizeWatcher containerStyle={StyleTemplates.fillFlex} onSizeChange={(width, height) => {
            setChartContainerWidth(width)
            setChartContainerHeight(height)
        }}>
            <CycleChartFrame
                {...props}
                chartArea={chartArea}
                chartContainerWidth={chartContainerWidth}
                chartContainerHeight={chartContainerHeight}
                cycleDomain={domain}
                xTickFormat={tickFormat}
                scaleX={scaleX}
                scaleY={scaleY}
                ticks={ticks}
                onClickElement={onClickElement}
                onLongPressIn={onLongPress}
                onLongPressMove={onLongPress}
                onLongPressOut={onLongPressOut}
            >
                <G x={chartArea.x} y={chartArea.y}>
                    {
                        props.values.map(value =>
                            <RangeValueElement key={value.timeKey} scaleX={scaleX} scaleY={scaleY} value={value} />)
                    }
                </G>
            </CycleChartFrame>

        </SizeWatcher>
    </View>
}
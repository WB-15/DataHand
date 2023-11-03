import React from 'react'
import { ScaleBand } from "d3-scale"
import Colors from "@style/Colors"
import { G, Text, Line } from "react-native-svg"
import { Sizes } from '@style/Sizes'
import { LayoutRectangle } from 'react-native'


export const DateBandAxis = React.memo((props: { scale: ScaleBand<number>, chartArea: LayoutRectangle, dateSequence: number[], today: number, tickFormat: (date: number) => string }) => {

    const divider = Math.ceil(props.dateSequence.length / 8)

    return <G x={props.chartArea.x} y={props.chartArea.y + props.chartArea.height}>
        <Line x1={0} x2={props.chartArea.width} y1={0} y2={0} stroke={Colors.textColorLight} strokeWidth={0.5} />

        {
            props.dateSequence.map((date, i) => {
                const tickFormatted = props.tickFormat(date)
                return <G key={date.toString()} x={props.scale(date)! + props.scale.bandwidth() / 2}>
                    {
                        (i % divider === 0 && divider > 1) && <Line x1={0} x2={0} y1={0} y2={7} stroke={Colors.chartLightText}/>
                    }
                    {
                        (i % divider === 0) && <Text textAnchor="middle" y={20} fill={props.today === date ? Colors.today : Colors.chartDimmedText} fontSize={Sizes.tinyFontSize}>{tickFormatted}</Text>
                    }
                </G>
            })
        }
    </G>
})
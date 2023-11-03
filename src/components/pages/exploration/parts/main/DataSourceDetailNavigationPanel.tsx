import React, { useState, useRef, useCallback, useMemo } from "react";
import { View, FlatList, Text, StyleSheet, ActivityIndicator, LayoutAnimation, UIManager, findNodeHandle, ViewStyle } from 'react-native';
import { MeasureUnitType, DataSourceType, inferIntraDayDataSourceType } from "@data-at-hand/core/measure/DataSourceSpec";
import { ExplorationAction, setTouchElementInfo, createGoToBrowseDayAction, setDataDrivenQuery } from "@state/exploration/interaction/actions";
import { connect } from "react-redux";
import { ReduxAppState } from "@state/types";
import { Dispatch } from "redux";
import { DataSourceBrowseData } from "@core/exploration/data/types";
import { DataSourceChartFrame } from "@components/exploration/DataSourceChartFrame";
import { explorationInfoHelper } from "@core/exploration/ExplorationInfoHelper";
import { TouchingElementInfo, TouchingElementValueType } from "@data-at-hand/core/exploration/TouchingElementInfo";
import { DateTimeHelper } from "@data-at-hand/core/utils/time";
import { format, startOfDay, addSeconds } from "date-fns";
import { StyleTemplates } from "@style/Styles";
import { Sizes } from "@style/Sizes";
import Colors from "@style/Colors";
import commaNumber from 'comma-number';
import unitConvert from 'convert-units';
import { TouchableHighlight } from "react-native-gesture-handler";
import { SvgIcon, SvgIconType } from "@components/common/svg/SvgIcon";
import { DataServiceManager } from "@measure/DataServiceManager";
import { DataDrivenQueryBar } from "@components/exploration/DataDrivenQueryBar";
import { DataDrivenQuery, NumericConditionType, ParameterType } from "@data-at-hand/core/exploration/ExplorationInfo";
import { InteractionType } from "@data-at-hand/core/exploration/actions";

const listItemHeightNormal = 52
const listItemHeightTall = 70

const styles = StyleSheet.create({
    listItemStyle: {
        ...StyleTemplates.flexHorizontalCenteredListContainer,
        backgroundColor: '#fdfdfd',
        paddingLeft: Sizes.horizontalPadding,
        paddingRight: Sizes.horizontalPadding,
        borderBottomColor: "#00000015",
        borderBottomWidth: 1
    },

    listItemHighlightStyle: {
        position: 'absolute',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        borderColor: Colors.accent + "60",
        borderWidth: 3
    },


    listItemDateStyle: {
        color: Colors.textGray,
        width: 120
    },

    listItemDateTodayStyle: {
        color: Colors.today,
        fontWeight: '500',
        width: 120
    },

    listItemValueContainerStyle: {
        ...StyleTemplates.fillFlex,
        paddingBottom: 12,
        paddingTop: 12
    },

    listItemValueDigitStyle: {
        fontSize: 16
    },

    listItemValueUnitStyle: {
        fontSize: 14,
        color: Colors.textGray
    },
    noItemIndicatorStyle: { alignSelf: 'center', color: Colors.textColorLight }

})

interface Props {
    isLoadingData?: boolean,
    source?: DataSourceType,
    dataset?: DataSourceBrowseData,
    sortedDailyItems?: Array<any>,
    measureUnitType?: MeasureUnitType,
    dataDrivenQuery?: DataDrivenQuery,
    pressedDate?: number,
    getToday?: () => Date,
    dispatchExplorationAction?: (action: ExplorationAction) => void
}

interface State {
    today: number,
    isLoadingAfterQueryUpdate: boolean,
}

class DataSourceDetailNavigationPanel extends React.PureComponent<Props, State>{

    private _listRef = React.createRef<FlatList<any>>()

    constructor(props: Props) {
        super(props)

        const dataList: Array<any> = (this.props.source === DataSourceType.Weight ? props.dataset.data.logs : props.dataset.data).slice(0)
        dataList.sort((a: any, b: any) => b["numberedDate"] - a["numberedDate"])


        this.state = {
            today: DateTimeHelper.toNumberedDateFromDate(props.getToday()),
            isLoadingAfterQueryUpdate: false,
        }
    }


    componentDidUpdate(prevProps: Props) {
        if (prevProps.isLoadingData !== this.props.isLoadingData && this.props.isLoadingData === false) {

            if (this.state.isLoadingAfterQueryUpdate === true) {


                if (this.props.dataDrivenQuery != null && (this.props.dataDrivenQuery?.type === NumericConditionType.Max || this.props.dataDrivenQuery?.type === NumericConditionType.Min)) {
                    const sourceRangedData = this.props.dataset as DataSourceBrowseData
                    const highlightedDates = Object.keys(sourceRangedData.highlightedDays).filter(date => sourceRangedData.highlightedDays[Number.parseInt(date)] === true).map(d => Number.parseInt(d))
                    if (highlightedDates.length === 1) {
                        //only one highlighted day, navigate to it
                        const index = this.props.sortedDailyItems.findIndex(d => d["numberedDate"] === highlightedDates[0])
                        if (index != -1) {
                            this._listRef.current?.scrollToIndex({
                                animated: true,
                                index,
                            })
                        }
                    }
                }

                this.setState({ ...this.state, isLoadingAfterQueryUpdate: false })
            }
        }

        if (prevProps.dataDrivenQuery !== this.props.dataDrivenQuery) {

            if (this.props.isLoadingData === true) {
                this.setState({ ...this.state, isLoadingAfterQueryUpdate: true })
            }

            LayoutAnimation.configureNext(
                LayoutAnimation.create(
                    500, LayoutAnimation.Types.easeInEaseOut, "opacity")
            )
        }
    }

    private readonly onListElementClick = (date: number) => {
        this.props.dispatchExplorationAction(createGoToBrowseDayAction(InteractionType.TouchOnly, inferIntraDayDataSourceType(this.props.source), date))
    }

    private readonly onListElementLongPressIn = (date: number, element: TouchingElementInfo) => {
        this.props.dispatchExplorationAction(setTouchElementInfo(element))
    }

    private readonly onListElementLongPressOut = (date: number) => {
        this.props.dispatchExplorationAction(setTouchElementInfo(null))
    }

    private readonly onDiscardFilter = () => {
        this.props.dispatchExplorationAction(setDataDrivenQuery(InteractionType.TouchOnly, null))
    }

    private readonly onFilterModified = (newFilter: DataDrivenQuery) => {
        this.props.dispatchExplorationAction(setDataDrivenQuery(InteractionType.TouchOnly, newFilter))
    }

    private getItemLayout = (_: any, index: number) => {
        const height = (this.props.source === DataSourceType.HoursSlept || this.props.source === DataSourceType.SleepRange) ? listItemHeightTall : listItemHeightNormal
        return { length: height, offset: height * index, index }
    }

    private renderItem = ({ item }: { item: any }) => <Item date={item["numberedDate"]}
        today={this.state.today} item={item} type={this.props.source}
        unitType={this.props.measureUnitType}
        isHovering={item["numberedDate"] === this.props.pressedDate}
        isInQueryResult={this.props.dataset?.highlightedDays?.[item["numberedDate"]] === true}
        onClick={this.onListElementClick}
        onLongPressIn={this.onListElementLongPressIn}
        onLongPressOut={this.onListElementLongPressOut}
    />

    render() {
        if (this.props.dataset != null) {
            return <>
                {
                    this.props.dataDrivenQuery != null ? <DataDrivenQueryBar
                        filter={this.props.dataDrivenQuery}
                        highlightedDays={this.props.dataset.highlightedDays}
                        onDiscardFilterPressed={this.onDiscardFilter}
                        onFilterModified={this.onFilterModified}
                    /> : null
                }
                <DataSourceChartFrame data={this.props.dataset}
                    filter={this.props.dataDrivenQuery}
                    highlightedDays={this.props.dataset.highlightedDays}
                    showToday={false}
                    flat={true}
                    showHeader={false}
                />
                {
                    this.props.sortedDailyItems.length > 0 && <FlatList ref={this._listRef} style={StyleTemplates.fillFlex}
                        data={this.props.sortedDailyItems}
                        renderItem={this.renderItem}
                        getItemLayout={this.getItemLayout}
                        keyExtractor={item => item["id"] || item["numberedDate"].toString()}
                    />
                }
                {
                    this.props.sortedDailyItems.length === 0 && <View style={StyleTemplates.contentVerticalCenteredContainer}>
                        <Text style={styles.noItemIndicatorStyle}>No data during this range.</Text>
                    </View>
                }
            </>
        } else return <ActivityIndicator />
    }
}


function mapDispatchToProps(dispatch: Dispatch, ownProps: Props): Props {
    return {
        ...ownProps,
        dispatchExplorationAction: (action) => dispatch(action)
    }
}

function mapStateToProps(appState: ReduxAppState, ownProps: Props): Props {

    let pressedDate: number = null
    if (appState.explorationState.touchingElement) {
        const date = explorationInfoHelper.getParameterValueOfParams<number>(appState.explorationState.touchingElement.params, ParameterType.Date)
        if (date != null) {
            pressedDate = date
        }
    }

    const source = explorationInfoHelper.getParameterValue<DataSourceType>(appState.explorationDataState.info, ParameterType.DataSource)

    const sourceRangedData = appState.explorationDataState.data as DataSourceBrowseData

    const dataList: Array<any> = (source === DataSourceType.Weight ? sourceRangedData.data.logs : sourceRangedData.data).slice(0)
    dataList.sort((a: any, b: any) => b["numberedDate"] - a["numberedDate"])

    return {
        ...ownProps,
        source,
        dataset: sourceRangedData,
        sortedDailyItems: dataList,
        measureUnitType: appState.settingsState.unit,
        isLoadingData: appState.explorationDataState.isBusy,
        pressedDate,
        dataDrivenQuery: appState.explorationState.info.dataDrivenQuery,
        getToday: DataServiceManager.instance.getServiceByKey(appState.settingsState.serviceKey).getToday
    }
}


const connected = connect(mapStateToProps, mapDispatchToProps)(DataSourceDetailNavigationPanel)

export { connected as DataSourceDetailNavigationPanel }


const Item = React.memo((prop: {
    date: number,
    item: any,
    today: number,
    type: DataSourceType,
    unitType: MeasureUnitType,
    isInQueryResult: boolean,
    isHovering: boolean,
    onClick: (date: number) => void,
    onLongPressIn: (date: number, touchingElement: TouchingElementInfo) => void,
    onLongPressOut: (date: number) => void
}) => {
    const dateString = useMemo(() => {
        var dateString
        if (prop.date === prop.today) {
            dateString = "Today"
        } else if (prop.today - prop.date === 1) {
            dateString = 'Yesterday'
        } else dateString = format(DateTimeHelper.toDate(prop.date), "MMM dd, eee")
        return dateString
    }, [prop.date, prop.today])

    const listItemStyle = useMemo(() => {
        let style: ViewStyle

        if (prop.type === DataSourceType.SleepRange || prop.type === DataSourceType.HoursSlept) style = { ...styles.listItemStyle, height: listItemHeightTall }
        else style = { ...styles.listItemStyle, height: listItemHeightNormal }

        if (prop.isInQueryResult === true) {
            style.backgroundColor = Colors.highlightElementBackgroundOpaque
        }
        return style
    }, [prop.type, prop.isInQueryResult])

    const valueView = useMemo(() => {
        let valueElement: any
        switch (prop.type) {
            case DataSourceType.StepCount:
                valueElement = <Text style={styles.listItemValueContainerStyle}>
                    <Text style={styles.listItemValueDigitStyle}>{commaNumber(prop.item.value)}</Text>
                    <Text style={styles.listItemValueUnitStyle}> steps</Text>
                </Text>
                break;
            case DataSourceType.HeartRate:
                valueElement = <Text style={styles.listItemValueContainerStyle}>
                    <Text style={styles.listItemValueDigitStyle}>{prop.item.value}</Text>
                    <Text style={styles.listItemValueUnitStyle}> bpm</Text>
                </Text>
                break;
            case DataSourceType.Weight:
                let valueText
                let unit
                switch (prop.unitType) {
                    case MeasureUnitType.US:
                        valueText = unitConvert(prop.item.value).from('kg').to('lb').toFixed(1)
                        unit = ' lb'
                        break;

                    case MeasureUnitType.Metric:
                    default:
                        valueText = prop.item.value.toFixed(1)
                        unit = ' kg'
                        break;
                }

                valueElement = <Text style={styles.listItemValueContainerStyle}>
                    <Text style={styles.listItemValueDigitStyle}>{valueText}</Text>
                    <Text style={styles.listItemValueUnitStyle}>{unit}</Text>
                </Text>
                break;

            case DataSourceType.HoursSlept:
            case DataSourceType.SleepRange:
                const pivot = startOfDay(DateTimeHelper.toDate(prop.date))

                const actualBedTime = addSeconds(pivot, Math.round(prop.item.bedTimeDiffSeconds))
                const actualWakeTime = addSeconds(pivot, Math.round(prop.item.wakeTimeDiffSeconds))

                let rangeText: string
                if (prop.item.bedTimeDiffSeconds != null && prop.item.wakeTimeDiffSeconds != null) {
                    rangeText = format(actualBedTime, 'hh:mm a').toLowerCase() + " - " + format(actualWakeTime, 'hh:mm a').toLowerCase()
                } else {
                    rangeText = ""
                }

                const lengthHr = Math.floor(prop.item.lengthInSeconds / 3600)
                let lengthMin = Math.floor((prop.item.lengthInSeconds % 3600) / 60)
                const lengthSec = prop.item.lengthInSeconds % 60
                if (lengthSec > 30) {
                    lengthMin++
                }

                const durationFormat = []
                if (lengthHr > 0) {
                    durationFormat.push({ type: 'value', text: lengthHr })
                    durationFormat.push({ type: 'unit', text: " hr" })
                }
                durationFormat.push({ type: "value", text: lengthHr > 0 ? (" " + lengthMin) : lengthMin })
                durationFormat.push({ type: "unit", text: " min" })


                valueElement = <View style={styles.listItemValueContainerStyle}>
                    <Text style={{ marginBottom: 8, fontSize: Sizes.smallFontSize, color: Colors.textColorLight }}>{rangeText}</Text>
                    <Text>
                        {
                            durationFormat.map((f, i) => <Text key={i}
                                style={f.type === 'value' ? styles.listItemValueDigitStyle : styles.listItemValueUnitStyle}>
                                {f.text}
                            </Text>)
                        }
                    </Text>
                </View>
                break;
        }
        return valueElement
    }, [prop.type, prop.item.bedTimeDiffSeconds, prop.item.wakeTimeDiffSeconds, prop.item.value])

    const onPress = useCallback(() => {
        prop.onClick(prop.date)
    }, [prop.onClick, prop.date])

    return <TouchableHighlight activeOpacity={0.95}
        //onLongPress={onLongPress}
        onPress={onPress}
    >

        <View style={listItemStyle}>
            <Text style={prop.today === prop.date ? styles.listItemDateTodayStyle : styles.listItemDateStyle}>{dateString}</Text>
            {
                valueView
            }
            <SvgIcon type={SvgIconType.ArrowRight} color={Colors.textGray} />
            {
                prop.isHovering === true && <View style={styles.listItemHighlightStyle} />
            }
        </View></TouchableHighlight>
})
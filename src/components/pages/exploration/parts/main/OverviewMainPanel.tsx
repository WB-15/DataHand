import { createGoToBrowseRangeAction, memoUIStatus, ExplorationAction, createGoToBrowseDayAction, setDataDrivenQuery } from "@state/exploration/interaction/actions";
import React from "react";
import { connect } from "react-redux";
import { ReduxAppState } from "@state/types";
import { FlatList, View, LayoutAnimation, NativeScrollEvent, NativeSyntheticEvent, ViewabilityConfig, ViewToken } from "react-native";
import { DataSourceChartFrame, HEADER_HEIGHT, FOOTER_HEIGHT } from "@components/exploration/DataSourceChartFrame";
import { OverviewData, OverviewSourceRow } from "@core/exploration/data/types";
import { DataSourceType, inferIntraDayDataSourceType } from "@data-at-hand/core/measure/DataSourceSpec";
import { Sizes } from "@style/Sizes";
import { DateTimeHelper } from "@data-at-hand/core/utils/time";
import { DataServiceManager } from "@measure/DataServiceManager";
import { DataDrivenQueryBar } from "@components/exploration/DataDrivenQueryBar";
import { DataSourceManager } from "@measure/DataSourceManager";
import { startLoadingForInfo } from "@state/exploration/data/reducers";
import { ThunkDispatch } from "redux-thunk";
import { DataService } from "@measure/service/DataService";
import { CommonBrowsingChartStyles, DateRangeScaleContext } from "@components/visualization/browse/common";
import { ScaleBand } from "d3-scale";
import { DataDrivenQuery } from "@data-at-hand/core/exploration/ExplorationInfo";
import { InteractionType } from "@data-at-hand/core/exploration/actions";

const MIN_REFRESH_TIME_FOR_PERCEPTION = 1000

const separatorStyle = { height: Sizes.verticalPadding }

interface Props {
    data?: OverviewData,
    isLoading?: boolean,
    overviewScrollY?: any,
    dataDrivenQuery?: DataDrivenQuery,
    selectedService?: DataService,
    dispatchAction?: (action: ExplorationAction) => void,
    dispatchDataReload?: () => void,
}

interface State {
    scaleX: ScaleBand<number>,
    refreshingSince?: number | null
}

class OverviewMainPanel extends React.PureComponent<Props, State> {

    static getDerivedStateFromProps(nextProps: Props, currentState: State): State | null {

        if (nextProps.data != null && nextProps.data.range != null) {

            const currenDomain = currentState.scaleX.domain()
            if (currenDomain[0] !== nextProps.data.range[0] || currenDomain[1] !== nextProps.data.range[1]){
                return {
                    ...currentState,
                    scaleX: CommonBrowsingChartStyles.makeDateScale(currentState.scaleX.copy(), nextProps.data.range[0], nextProps.data.range[1])
                }
            }else return null
        } else return null
    }

    private _listRef = React.createRef<FlatList<any>>()

    currentListScrollOffset: number

    currentTimeoutForRefreshingFlag: NodeJS.Timeout | undefined = undefined

    constructor(props: Props) {
        super(props)

        this.state = {
            scaleX: CommonBrowsingChartStyles.makeDateScale(undefined, props.data.range[0], props.data.range[1]),
            refreshingSince: null
        }
    }

    componentDidMount() {
        console.log("mount overview main panel.")
        if (this._listRef.current != null && this.props.overviewScrollY != null) {
            requestAnimationFrame(() => {
                this._listRef.current.scrollToOffset({ offset: this.props.overviewScrollY, animated: false })
            })
        }

        if(this.props.data != null){
            const viewableDataSources = this.props.data.sourceDataList.map(d => d.source)
            this.props.dispatchAction(memoUIStatus("viewableDataSources", viewableDataSources))
        }
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.dataDrivenQuery !== this.props.dataDrivenQuery) {
            LayoutAnimation.configureNext(
                LayoutAnimation.create(
                    500, LayoutAnimation.Types.easeInEaseOut, "opacity")
            )

            if (this.props.dataDrivenQuery != null && (prevProps.dataDrivenQuery == null || prevProps.dataDrivenQuery.dataSource !== this.props.dataDrivenQuery.dataSource)) {
                this._listRef.current?.scrollToIndex({
                    animated: true,
                    index: this.props.data.sourceDataList.findIndex(d => d.source === this.props.dataDrivenQuery.dataSource)
                })
            }
        }

        if (prevProps.isLoading === true && this.props.isLoading === false && this.state.refreshingSince != null) {

            if (this.currentTimeoutForRefreshingFlag) {
                clearTimeout(this.currentTimeoutForRefreshingFlag)
            }

            const minLoadingTimeLeft = Math.max(MIN_REFRESH_TIME_FOR_PERCEPTION, Date.now() - this.state.refreshingSince)
            if (minLoadingTimeLeft > 0) {
                this.currentTimeoutForRefreshingFlag = setTimeout(() => {
                    this.setState({
                        ...this.state,
                        refreshingSince: null
                    })
                    console.log("finished refreshing.")
                }, minLoadingTimeLeft)
            } else {
                this.setState({
                    ...this.state,
                    refreshingSince: null
                })

                console.log("finished refreshing.")
            }
        }
    }

    componentWillUnmount() {
        console.log("unmount overview main panel.")
        this.props.dispatchAction(memoUIStatus("overviewScrollY", this.currentListScrollOffset))
        this.props.dispatchAction(memoUIStatus("viewableDataSources", undefined))
    }

    private readonly onDiscardFilter = () => {
        this.props.dispatchAction(setDataDrivenQuery(InteractionType.TouchOnly, null))
    }

    private readonly onFilterModified = (newFilter: DataDrivenQuery) => {
        this.props.dispatchAction(setDataDrivenQuery(InteractionType.TouchOnly, newFilter))
    }


    private readonly onHeaderPressed = (source: DataSourceType) => {
        this.props.dispatchAction(createGoToBrowseRangeAction(InteractionType.TouchOnly, source))
    }

    private readonly onTodayPressed = (source: DataSourceType) => {
        this.props.dispatchAction(createGoToBrowseDayAction(InteractionType.TouchOnly,
            inferIntraDayDataSourceType(source), DateTimeHelper.toNumberedDateFromDate(this.props.selectedService.getToday())))
    }

    //FlatList handlers ==========================================================================================

    private readonly Separator = () => {
        return <View style={separatorStyle} />
    }


    private readonly onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const scrollY = event.nativeEvent.contentOffset.y
        this.currentListScrollOffset = scrollY
    }


    private readonly getItemLayout = (_: any, index: number) => {
        const height = CommonBrowsingChartStyles.CHART_HEIGHT + HEADER_HEIGHT + FOOTER_HEIGHT + separatorStyle.height
        return { length: height, offset: height * index, index }
    }


    private readonly renderItem = ({ item }: { item: OverviewSourceRow }) => <DataSourceChartFrame key={item.source.toString()}
        data={item}
        filter={this.props.dataDrivenQuery}
        highlightedDays={this.props.data.highlightedDays}
        onHeaderPressed={this.onHeaderPressed}
        onTodayPressed={inferIntraDayDataSourceType(item.source) != null ? this.onTodayPressed : null}
    />

    private readonly keyExtractor = (item: OverviewSourceRow) => item.source

    private readonly onRefresh = async () => {
        console.log("start refresh")
        this.setState({
            ...this.state,
            refreshingSince: Date.now()
        })

        await this.props.selectedService.refreshDataToReflectRecentInfo()

        this.props.dispatchDataReload()
    }

    private readonly onViewableItemsChanged = (args: { viewableItems: Array<ViewToken>, changed: Array<ViewToken> }) => {
        const viewableDataSources = args.viewableItems.map(token => token.key as DataSourceType)
        this.props.dispatchAction(memoUIStatus("viewableDataSources", viewableDataSources))
    }

    private readonly viewabilityConfig = {
        itemVisiblePercentThreshold: 95,
        minimumViewTime: 500,
        waitForInteraction: true
     } as ViewabilityConfig

    //===============================================================================================================

    render() {
        if (this.props.data != null) {
            return <DateRangeScaleContext.Provider value={this.state.scaleX}>
                {
                    this.props.dataDrivenQuery != null ? <DataDrivenQueryBar
                        filter={this.props.dataDrivenQuery}
                        highlightedDays={this.props.data.highlightedDays}
                        onDiscardFilterPressed={this.onDiscardFilter}
                        onFilterModified={this.onFilterModified}
                    /> : <></>
                }
                <FlatList
                    ref={this._listRef}
                    windowSize={DataSourceManager.instance.supportedDataSources.length}

                    extraData={this.props.dataDrivenQuery}

                    viewabilityConfig = {this.viewabilityConfig}
                    onViewableItemsChanged = {this.onViewableItemsChanged}

                    data={this.props.data.sourceDataList}
                    keyExtractor={this.keyExtractor}
                    ItemSeparatorComponent={this.Separator}
                    renderItem={this.renderItem}
                    onScroll={this.onScroll}
                    refreshing={this.state.refreshingSince != null}
                    onRefresh={this.onRefresh}
                    getItemLayout={this.getItemLayout}
                />
            </DateRangeScaleContext.Provider>
        } else return <></>
    }
}


function mapStateToProps(state: ReduxAppState, ownProps: Props): Props {

    const selectedService = DataServiceManager.instance.getServiceByKey(state.settingsState.serviceKey)

    return {
        ...ownProps,
        isLoading: state.explorationDataState.isBusy,
        data: state.explorationDataState.data,
        overviewScrollY: state.explorationState.uiStatus.overviewScrollY,
        dataDrivenQuery: state.explorationState.info.dataDrivenQuery,
        selectedService,
    }
}

function mapDispatchToProps(dispatch: ThunkDispatch<{}, {}, any>, ownProps: Props): Props {
    return {
        ...ownProps,
        dispatchAction: (action) => dispatch(action),
        dispatchDataReload: () => dispatch(startLoadingForInfo(undefined, true))
    }
}

const overviewMainPanel = connect(mapStateToProps, mapDispatchToProps)(OverviewMainPanel)
export { overviewMainPanel as OverviewMainPanel }
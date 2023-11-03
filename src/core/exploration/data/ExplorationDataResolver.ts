import { OverviewData, OverviewSourceRow, GroupedData, GroupedRangeData, IAggregatedValue, IAggregatedRangeValue, RangeAggregatedComparisonData, FilteredDailyValues, StepCountRangedData, WeightRangedData, DataSourceBrowseData } from './types';
import { explorationInfoHelper } from '@core/exploration/ExplorationInfoHelper';
import { DataSourceManager } from '@measure/DataSourceManager';
import { DataServiceManager } from '@measure/DataServiceManager';
import { DataSourceType, IntraDayDataSourceType } from '@data-at-hand/core/measure/DataSourceSpec';
import { CyclicTimeFrame, CycleDimension } from '@data-at-hand/core/exploration/CyclicTimeFrame';
import { DateTimeHelper } from '@data-at-hand/core/utils/time';
import { DataService } from '@measure/service/DataService';
import { sum, mean, min, max } from 'd3-array';
import { fastConcatTo } from '@data-at-hand/core/utils';
import { ExplorationInfo, ExplorationType, ParameterType, ParameterKey } from '@data-at-hand/core/exploration/ExplorationInfo';


const dateSortFunc = (a: { numberedDate: number; }, b: { numberedDate: number; }) => {
  if (a.numberedDate > b.numberedDate) {
    return 1
  } else if (a.numberedDate === b.numberedDate) {
    return 0
  } else return -1
}

class ExplorationDataResolver {

  loadData(
    explorationInfo: ExplorationInfo,
    selectedServiceKey: string,
    prevInfo?: ExplorationInfo,
    prevServiceKey?: string,
    prevData?: any,
  ): Promise<any> {
    const usePrevData = selectedServiceKey === prevServiceKey
    switch (explorationInfo.type) {
      case ExplorationType.B_Overview:
        return this.loadOverviewData(explorationInfo, selectedServiceKey, usePrevData === true ? prevInfo : undefined, usePrevData === true ? prevData : null);
      case ExplorationType.B_Range:
        return this.loadBrowseRangeData(explorationInfo, selectedServiceKey, usePrevData === true ? prevInfo : undefined, usePrevData === true ? prevData : null);
      case ExplorationType.B_Day:
        return this.loadIntraDayData(explorationInfo, selectedServiceKey)
      case ExplorationType.C_Cyclic:
        return this.loadCyclicComparisonData(explorationInfo, selectedServiceKey)
      case ExplorationType.C_TwoRanges:
        return this.loadTwoRangeComparisonData(explorationInfo, selectedServiceKey)
      case ExplorationType.C_CyclicDetail_Range:
        return this.loadCyclicRangeDetailData(explorationInfo, selectedServiceKey)
      case ExplorationType.C_CyclicDetail_Daily:
        return this.loadCyclicDailyDetailData(explorationInfo, selectedServiceKey)
      default:
        Promise.reject({ error: 'Unsupported exploration type.' });
    }

    return Promise.resolve(null)
  }

  private async loadBrowseRangeData(info: ExplorationInfo, selectedServiceKey: string, prevInfo?: ExplorationInfo, prevData?: any): Promise<DataSourceBrowseData> {
    const range = explorationInfoHelper.getParameterValue<[number, number]>(
      info,
      ParameterType.Range,
    );
    const source = explorationInfoHelper.getParameterValue<DataSourceType>(info, ParameterType.DataSource)

    const selectedService = DataServiceManager.instance.getServiceByKey(
      selectedServiceKey,
    );

    let prevSourceRowData: OverviewSourceRow
    if (prevInfo != null && prevData != null) {
      if (prevInfo.type === ExplorationType.B_Overview) {
        prevSourceRowData = (prevData as OverviewData).sourceDataList.find(e => e.source === source)!
      } else if (prevInfo.type === ExplorationType.B_Range) {
        const prevSource = explorationInfoHelper.getParameterValue<DataSourceType>(prevInfo, ParameterType.DataSource)
        if (prevSource === source) {
          prevSourceRowData = prevData
        }
      }
    }

    const data = await this.loadBrowseRangeDataImpl(range, source, selectedService, prevSourceRowData!)
    return {
      ...data,
      highlightedDays: info.dataDrivenQuery ? (await selectedService.fetchFilteredDates(info.dataDrivenQuery!, range[0], range[1])) : undefined
    }
  }

  private async loadBrowseRangeDataImpl(range: [number, number], source: DataSourceType, service: DataService, prevData?: OverviewSourceRow): Promise<OverviewSourceRow> {
    if (prevData) {
      const benchmarkStart = Date.now()
      const newQueryRegion = DateTimeHelper.subtract(range, prevData.range as [number, number])
      if (newQueryRegion.overlap === true && newQueryRegion.rest.length < 2) {
        //get partial part of the data
        const newData: OverviewSourceRow = {
          ...prevData,
          range,
        }

        //Filter prev data
        //Query new parts to query
        let newPart: OverviewSourceRow | null = null
        if (newQueryRegion.rest.length > 0) {
          newPart = await service.fetchData(source, newQueryRegion.rest[0][0], newQueryRegion.rest[0][1], false, false)
        }

        switch (source) {
          case DataSourceType.StepCount:
          case DataSourceType.HeartRate:
          case DataSourceType.SleepRange:
          case DataSourceType.HoursSlept:
            {
              newData.data = prevData.data.filter((datum: { numberedDate: number; }) => datum.numberedDate <= range[1] && datum.numberedDate >= range[0])
              if (newPart) {
                fastConcatTo(newData.data, newPart.data)
              }
              newData.data.sort(dateSortFunc)
            }
            break;
          case DataSourceType.Weight:
            {
              const casted = prevData as WeightRangedData
              newData.data = {
                trend: casted.data.trend.filter(datum => datum.numberedDate <= range[1] && datum.numberedDate >= range[0]),
                logs: casted.data.logs.filter(datum => datum.numberedDate <= range[1] && datum.numberedDate >= range[0]),
                futureNearestLog: casted.data.futureNearestLog,
                pastNearestLog: casted.data.pastNearestLog
              }

              if (newPart) {
                fastConcatTo(newData.data.trend, newPart.data.trend)
                fastConcatTo(newData.data.logs, newPart.data.logs)

                if(casted.range[0] > range[0]){
                  newData.data.pastNearestLog = newPart.data.pastNearestLog
                }

                if(casted.range[1] < range[1]){
                  newData.data.futureNearestLog = newPart.data.futureNearestLog
                }
              }

              newData.data.logs.sort(dateSortFunc)
              newData.data.trend.sort(dateSortFunc)

              if(newData.data.pastNearestLog == null && newPart == null && range[0] > casted.range[0] && casted.data.logs.length > 0){
                //find nearestLog from prevData.
                const excludeIndex = casted.data.logs.findIndex(l => l.numberedDate >= range[0])
                if(excludeIndex > 0){
                  newData.data.pastNearestLog = casted.data.logs[excludeIndex - 1]
                }else if(excludeIndex === -1){
                  newData.data.pastNearestLog = casted.data.logs[casted.data.logs.length - 1]
                }
              }
            }
            break;
        }

        switch (source) {
          case DataSourceType.StepCount:
          case DataSourceType.HeartRate:
            newData.statistics.forEach(statistic => {
              switch (statistic.type) {
                case "avg":
                  {
                    statistic.value = mean(newData.data, (d: any) => d["value"])
                  }
                  break;
                case 'range':
                  {
                    statistic.value = [min(newData.data, (d: any) => d["value"]), max(newData.data, (d: any) => d["value"])]
                  }
                  break;
                case 'total':
                  {
                    statistic.value = sum(newData.data, (d: any) => d["value"])
                  }
                  break;
              }
            })
            break;
          case DataSourceType.Weight:
            newData.statistics.forEach(statistic => {
              switch (statistic.type) {
                case "avg":
                  {
                    statistic.value = mean(newData.data.trend, (d: any) => d["value"])
                  }
                  break;
                case 'range':
                  {
                    statistic.value = [min(newData.data.trend, (d: any) => d["value"]), max(newData.data.trend, (d: any) => d["value"])]
                  }
                  break;
              }
            })
            break;


          case DataSourceType.HoursSlept:
            newData.statistics.forEach(statistic => {
              switch (statistic.type) {
                case "avg":
                  {
                    statistic.value = mean(newData.data, (d: any) => d["lengthInSeconds"])
                  }
                  break;
                case 'range':
                  {
                    statistic.value = [min(newData.data, (d: any) => d["lengthInSeconds"]), max(newData.data, (d: any) => d["lengthInSeconds"])]
                  }
                  break;
                case 'total':
                  {
                    statistic.value = sum(newData.data, (d: any) => d["lengthInSeconds"])
                  }
                  break;
              }
            })
            break;

          case DataSourceType.SleepRange:
            newData.statistics.forEach(statistic => {
              switch (statistic.type) {
                case 'waketime':
                  {
                    statistic.value = mean(newData.data, (d: any) => d["wakeTimeDiffSeconds"])
                  }
                  break;
                case 'bedtime':
                  {
                    statistic.value = mean(newData.data, (d: any) => d["bedTimeDiffSeconds"])
                  }
                  break;
              }
            })
            break;
        }


        console.log("Reusing prevData for rangeData took ", Date.now() - benchmarkStart, "millis.")
        return newData
      }
    }

    const data = await service.fetchData(source, range[0], range[1])
    data.preferredValueRange = await service.getPreferredValueRange(source)

    data.goal = await service.getGoalValue(source)
    
    return data
  }

  private loadOverviewData(info: ExplorationInfo, selectedServiceKey: string, prevInfo?: ExplorationInfo, prevData?: any): Promise<OverviewData> {
    const range = explorationInfoHelper.getParameterValue<[number, number]>(
      info,
      ParameterType.Range,
    );

    const selectedService = DataServiceManager.instance.getServiceByKey(
      selectedServiceKey,
    );

    return Promise.all(
      DataSourceManager.instance.supportedDataSources.map(source => {
        let prevSourceRowData: OverviewSourceRow
        if (prevInfo != null && prevData != null) {
          if (prevInfo.type === ExplorationType.B_Overview) {
            prevSourceRowData = (prevData as OverviewData).sourceDataList.find(e => e.source === source.type)!
          } else if (prevInfo.type === ExplorationType.B_Range) {
            const prevSource = explorationInfoHelper.getParameterValue<DataSourceType>(prevInfo, ParameterType.DataSource)
            if (prevSource === source.type) {
              prevSourceRowData = prevData
            }
          }
        }

        return this.loadBrowseRangeDataImpl(range, source.type, selectedService, prevSourceRowData!)
      }))
      .then(async dataPerSource => ({ 
        range,
        sourceDataList: dataPerSource, 
        highlightedDays: info.dataDrivenQuery ? (await selectedService.fetchFilteredDates(info.dataDrivenQuery!, range[0], range[1])) : undefined }));
  }

  private loadIntraDayData(
    info: ExplorationInfo,
    selectedServiceKey: string
  ): Promise<any> {
    const selectedService = DataServiceManager.instance.getServiceByKey(
      selectedServiceKey,
    );
    const source = explorationInfoHelper.getParameterValue<IntraDayDataSourceType>(info, ParameterType.IntraDayDataSource)
    const date = explorationInfoHelper.getParameterValue<number>(info, ParameterType.Date)

    return selectedService.fetchIntraDayData(source, date)
  }

  private async loadCyclicComparisonData(info: ExplorationInfo, selectedServiceKey: string): Promise<GroupedData | GroupedRangeData> {

    const selectedService = DataServiceManager.instance.getServiceByKey(
      selectedServiceKey,
    );
    const source = explorationInfoHelper.getParameterValue<DataSourceType>(info, ParameterType.DataSource)
    const range = explorationInfoHelper.getParameterValue<[number, number]>(
      info,
      ParameterType.Range,
    );
    const cycleType = explorationInfoHelper.getParameterValue<CyclicTimeFrame>(info, ParameterType.CycleType)

    const data = await selectedService.fetchCyclicAggregatedData(source, range[0], range[1], cycleType)
    data.preferredValueRange = await selectedService.getPreferredValueRange(source)
    return data
  }

  private async loadCyclicRangeDetailData(info: ExplorationInfo, selectedServiceKey: string): Promise<RangeAggregatedComparisonData<IAggregatedValue | IAggregatedRangeValue>> {
    const selectedService = DataServiceManager.instance.getServiceByKey(
      selectedServiceKey,
    );
    const source = explorationInfoHelper.getParameterValue<DataSourceType>(
      info,
      ParameterType.DataSource,
    );
    const range = explorationInfoHelper.getParameterValue<[number, number]>(
      info,
      ParameterType.Range,
    );
    const cycleDimension = explorationInfoHelper.getParameterValue<CycleDimension>(
      info,
      ParameterType.CycleDimension,
    );

    const data = await selectedService.fetchCycleRangeDimensionData(source, range[0], range[1], cycleDimension)
    data.preferredValueRange = await selectedService.getPreferredValueRange(source)
    return data
  }

  private loadCyclicDailyDetailData(info: ExplorationInfo, selectedServiceKey: string): Promise<FilteredDailyValues> {
    const selectedService = DataServiceManager.instance.getServiceByKey(
      selectedServiceKey,
    );
    const source = explorationInfoHelper.getParameterValue<DataSourceType>(
      info,
      ParameterType.DataSource,
    );
    const range = explorationInfoHelper.getParameterValue<[number, number]>(
      info,
      ParameterType.Range,
    );
    const cycleDimension = explorationInfoHelper.getParameterValue<CycleDimension>(
      info,
      ParameterType.CycleDimension,
    );

    return selectedService.fetchCycleDailyDimensionData(source, range[0], range[1], cycleDimension)
  }


  private async loadTwoRangeComparisonData(info: ExplorationInfo, selectedServiceKey: string): Promise<RangeAggregatedComparisonData<IAggregatedValue | IAggregatedRangeValue>> {
    const selectedService = DataServiceManager.instance.getServiceByKey(
      selectedServiceKey,
    );
    const source = explorationInfoHelper.getParameterValue<DataSourceType>(info, ParameterType.DataSource)
    const rangeA = explorationInfoHelper.getParameterValue<[number, number]>(
      info,
      ParameterType.Range,
      ParameterKey.RangeA
    );
    const rangeB = explorationInfoHelper.getParameterValue<[number, number]>(
      info,
      ParameterType.Range,
      ParameterKey.RangeB
    );

    const dataA = await selectedService.fetchRangeAggregatedData(source, rangeA[0], rangeA[1])
    const dataB = await selectedService.fetchRangeAggregatedData(source, rangeB[0], rangeB[1])

    return {
      data: [
        { range: rangeA, value: dataA },
        { range: rangeB, value: dataB }
      ],
      preferredValueRange: await selectedService.getPreferredValueRange(source)
    }
  }
}

const resolver = new ExplorationDataResolver();

export { resolver as explorationDataResolver };

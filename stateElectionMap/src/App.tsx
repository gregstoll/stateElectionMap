import React, { Component } from 'react';
import { StateMap } from './StateMap';
import { Button } from 'semantic-ui-react';
import _ from 'lodash';
import { loadAllData, DataCollection, StateName, StateInfos, ElectionData, ElectionStateResult, MIN_YEAR, MAX_YEAR, YEAR_STEP } from './DataHandling';
import { MapDateSlider, MapDate } from './MapDateSlider';
import ReactChartkick, { LineChart } from 'react-chartkick';
import Chart from 'chart.js';

import 'rc-slider/assets/index.css';
import './App.css';

ReactChartkick.addAdapter(Chart);

interface AppState {
    year: number,
    selectedStateCode: string,
    rawResults: boolean,
    isCartogram: boolean,
    stateInfos: StateInfos,
    electionData: ElectionData
}

class App extends Component<{}, AppState> {
    state: AppState = {
        year: 0,
        selectedStateCode: undefined,
        isCartogram: true,
        rawResults: true,
        stateInfos: null,
        electionData: null
    };

    componentDidMount() {
        this.loadDataAsync();
    }

    async loadDataAsync() {
        let data: DataCollection = await loadAllData();
        let yearState = { year: _.max(Array.from(data.electionData.keys())) };
        this.setState(Object.assign(yearState, data));
    }

    dAdvantageFromVotes(stateData: ElectionStateResult, baselineDAdvantage = 0): number {
        let dAdvantage = ((stateData.dCount - stateData.rCount) * 100.0) / stateData.totalCount;
        return dAdvantage - baselineDAdvantage;
    }

    colorFromDAndRVote(dVote: number, rVote: number, totalVote: number, baselineDAdvantage = 0) {
        // http://colorbrewer2.org/?type=diverging&scheme=RdBu&n=11
        const _colors =
            ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#f7f7f7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac', '#053061'];

        let dAdvantage = ((dVote - rVote) * 100.0) / totalVote;
        // 5 red, 5 blue (don't use middle one)
        const increment = 3;
        if (dAdvantage < baselineDAdvantage - 4 * increment) {
            return _colors[0];
        }
        if (dAdvantage < baselineDAdvantage - 3 * increment) {
            return _colors[1];
        }
        if (dAdvantage < baselineDAdvantage - 2 * increment) {
            return _colors[2];
        }
        if (dAdvantage < baselineDAdvantage - 1 * increment) {
            return _colors[3];
        }
        if (dAdvantage < baselineDAdvantage) {
            return _colors[4];
        }

        if (dAdvantage > baselineDAdvantage + 4 * increment) {
            return _colors[10];
        }
        if (dAdvantage > baselineDAdvantage + 3 * increment) {
            return _colors[9];
        }
        if (dAdvantage > baselineDAdvantage + 2 * increment) {
            return _colors[8];
        }
        if (dAdvantage > baselineDAdvantage + increment) {
            return _colors[7];
        }
        return _colors[6];
    }

    textFromDAdvantage(dAdvantage: number) {
        if (dAdvantage > 0) {
            return "D+" + (dAdvantage).toFixed(1) + "%";
        }
        if (dAdvantage < 0) {
            return "R+" + (-1 * dAdvantage).toFixed(1) + "%";
        }
        return "Even";
    }

    onSliderDateChange = (date: MapDate) => {
        this.setState({ year: date.year });
    }

    onStateSelected = (stateCode) => {
        this.setState({ selectedStateCode: stateCode });
    }

    render = () => {
        if (!(this.state.stateInfos && this.state.year)) {
            return <div>Loading</div>;
        }

        let stateColors = new Map<string, string>();
        let stateTitles = new Map<string, string>();
        let lineChart = undefined;
        let electionData = this.state.electionData.get(this.state.year);
        let nationalDAdvantage = electionData.nationalDAdvantage;
        let baselineDAdvantage = this.state.rawResults ? 0 : electionData.nationalDAdvantage;
        //TODO - performance https://stackoverflow.com/questions/37699320/iterating-over-typescript-map
        let a = Array.from(this.state.stateInfos.codeToStateName.entries());
        for (let [stateCode, value] of a) {
            let stateData = electionData.stateResults.get(stateCode);
            if (stateData) {
                // TODO - duplication or something
                let dAdvantage = this.dAdvantageFromVotes(stateData, baselineDAdvantage);
                stateColors.set(stateCode, this.colorFromDAndRVote(stateData.dCount, stateData.rCount, stateData.totalCount, baselineDAdvantage));
                stateTitles.set(stateCode, this.textFromDAdvantage(dAdvantage));
            }
        }

        if (this.state.selectedStateCode) {
            let data = {};
            let min = 0, max = 0;
            for (let year = MIN_YEAR; year <= MAX_YEAR; year += YEAR_STEP) {
                let yearElectionData = this.state.electionData.get(year);
                let yearBaselineDAdvantage = this.state.rawResults ? 0 : yearElectionData.nationalDAdvantage;
                let stateData = yearElectionData.stateResults.get(this.state.selectedStateCode);
                let y = this.dAdvantageFromVotes(stateData, yearBaselineDAdvantage);
                data[year] = y;

                min = Math.min(min, y);
                max = Math.max(max, y);
            }
            min = Math.floor(min / 5) * 5;
            max = Math.ceil(max / 5) * 5;
            let stateNameObj = this.state.stateInfos.codeToStateName.get(this.state.selectedStateCode);
            let yMin = Math.min(-2, min);
            let yMax = Math.max(2, max);
            lineChart = <div style={{ width: 500 }} className="centerFixedWidth">{stateNameObj.name}
                <LineChart width={500} height={300}
                    data={[{ "name": "margin", "data": data }]}
                    xtitle="Year" ytitle={this.state.rawResults ? "advantage" : "relative to national"} curve={false} legend={false} colors={['green', 'gray']}
                    min={min} max={max}
                    library={{
                        scales: {
                            yAxes: [{
                                ticks: {
                                    callback: function (value, index, values) {
                                        if (value > 0) {
                                            return "D+" + value;
                                        }
                                        else if (value < 0) {
                                            return "R+" + (-1 * value);
                                        }
                                        else {
                                            return "Even"
                                        }
                                    }
                                }
                            }]
                        },
                        tooltips: {
                            callbacks: {
                                label: function (tooltipItem, data) {
                                    let label = data.datasets[tooltipItem.datasetIndex].label || '';

                                    if (label) {
                                        label += ': ';
                                    }
                                    let valueText = "Even";
                                    if (tooltipItem.yLabel > 0) {
                                        valueText = "D+" + tooltipItem.yLabel.toFixed(1) + "%";
                                    }
                                    else if (tooltipItem.yLabel < 0) {
                                        valueText = "R+" + (-1 * tooltipItem.yLabel).toFixed(1) + "%";
                                    }
                                    label += valueText;
                                    return label;
                                }
                            }
                        }
                    }}
                />
                </div>;
        }

        // https://react-component.github.io/slider/examples/slider.html
        return (
            <div className="App">
                <svg width="1100" height="500">
                    <StateMap isCartogram={this.state.isCartogram}
                        stateColors={stateColors}
                        stateTitles={stateTitles}
                        stateSelectedCallback={this.onStateSelected}
                        x={0}
                        y={0}
                        width={500}
                        height={500} />
                </svg>
                <div>
                    <Button.Group>
                        <Button active={this.state.rawResults} onClick={() => this.setState({ rawResults: true })}>Actual results</Button>
                        <Button.Or />
                        <Button active={!this.state.rawResults} onClick={() => this.setState({ rawResults: false })}>Relative to popular vote</Button>
                    </Button.Group>
                    <div>Year {this.state.year} Popular vote: {this.textFromDAdvantage(nationalDAdvantage)}</div>
                    <Button.Group>
                        <Button active={!this.state.isCartogram} onClick={() => this.setState({ isCartogram: false })}>Normal</Button>
                        <Button.Or />
                        <Button active={this.state.isCartogram} onClick={() => this.setState({ isCartogram: true })}>Cartogram</Button>
                    </Button.Group>
                </div>
                <div style={{ width: 500 }} className="centerFixedWidth">
                    <MapDateSlider
                        yearsPerTick={YEAR_STEP}
                        ticksPerYear={undefined}
                        startDate={new MapDate(MIN_YEAR, 11)}
                        endDate={new MapDate(MAX_YEAR, 11)}
                        currentDate={new MapDate(this.state.year, 11)}
                        onDateChange={this.onSliderDateChange}/>
                </div>
                {lineChart}

            </div>
        );
    }
}

export default App;

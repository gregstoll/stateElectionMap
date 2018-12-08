import React, { Component } from 'react';
import { StateMap } from './StateMap';
import { Button } from 'semantic-ui-react';
import _ from 'lodash';
import { loadAllData, DataCollection, StateName, ElectionData, ElectionStateResult, MIN_YEAR, MAX_YEAR, YEAR_STEP } from './DataHandling';
import Slider from 'rc-slider';
import * as d3 from 'd3';
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
    //TODO - figure out this type and use it everywhere
    //TODO - combine with DataCollection I guess
    usTopoJson: any,
    cartogram: d3.Selection<HTMLElement, () => any, null, undefined>,
    stateNames: StateName[],
    electionData: ElectionData
}

class App extends Component<{}, AppState> {
    state: AppState = {
        year: 0,
        selectedStateCode: undefined,
        isCartogram: true,
        rawResults: true,
        usTopoJson: null,
        cartogram: null,
        stateNames: null,
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

    onSliderChange = (value) => {
        this.setState({ year: value });
    }

    onStateSelected = (stateCode) => {
        this.setState({ selectedStateCode: stateCode });
    }

    render() {
        if (!(this.state.usTopoJson && this.state.stateNames && this.state.year)) {
            return <div>Loading</div>;
        }

        let stateColors = new Map<string, string>();
        let stateTitles = new Map<string, string>();
        let lineChart = undefined;
        let electionData = this.state.electionData.get(this.state.year);
        let nationalDAdvantage = electionData.nationalDAdvantage;
        let baselineDAdvantage = this.state.rawResults ? 0 : electionData.nationalDAdvantage;
        for (let i in this.state.stateNames) {
            let stateCode = this.state.stateNames[i].code;
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
            // TODO optimize this
            let stateNameObj = _.find(this.state.stateNames, stateNameObj => stateNameObj.code === this.state.selectedStateCode);
            let yMin = Math.min(-2, min);
            let yMax = Math.max(2, max);
            lineChart = <div style={{ width: 600 }}>{stateNameObj.name}
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
                    <StateMap usTopoJson={this.state.usTopoJson}
                        cartogram={this.state.cartogram}
                        isCartogram={this.state.isCartogram}
                        stateNames={this.state.stateNames}
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
                        <Button active={!this.state.rawResults} onClick={() => this.setState({ rawResults: false })}>Relative to popular vote</Button>
                    </Button.Group>
                    <Button.Group>
                        <Button active={!this.state.isCartogram} onClick={() => this.setState({ isCartogram: false })}>Normal</Button>
                        <Button active={this.state.isCartogram} onClick={() => this.setState({ isCartogram: true })}>Cartogram</Button>
                    </Button.Group>
                </div>
                <div>Year {this.state.year} Popular vote: {this.textFromDAdvantage(nationalDAdvantage)}</div>
                <div style={{ width: 500 }}>
                    <Slider min={MIN_YEAR} max={MAX_YEAR} step={YEAR_STEP} value={this.state.year} onChange={this.onSliderChange} />
                </div>
                {lineChart}

            </div>
        );
    }
}

export default App;

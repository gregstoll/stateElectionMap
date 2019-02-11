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
import { isNullOrUndefined } from 'util';
import { string } from 'prop-types';

ReactChartkick.addAdapter(Chart);

interface AppState {
    year: number,
    selectedStateCode: string,
    rawResults: boolean,
    isCartogram: boolean,
    stateInfos: StateInfos,
    electionData: ElectionData,
    haveUpdatedFromHash: boolean,
    loadError: string
}

class App extends Component<{}, AppState> {
    state: AppState = {
        year: 0,
        selectedStateCode: undefined,
        isCartogram: true,
        rawResults: true,
        stateInfos: null,
        electionData: null,
        haveUpdatedFromHash: false,
        loadError: undefined
    };

    updateInitialStateFromHash() {
        if (this.dataHasLoaded() && !this.state.haveUpdatedFromHash) {
            this.setStateFromHash();
        }
    }

    componentDidMount() {
        this.loadDataAsync();
        this.updateInitialStateFromHash();
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        this.updateInitialStateFromHash();
    }

    static getDerivedStateFromError(error) {
        return { loadError: error };
    }

    componentDidCatch(error, info) {
        this.setState({ loadError: error });
    }

    onMapError = (error) => {
        this.setState({ loadError: "Error loading map: " + this.errorStringFromError(error) });
    }

    async loadDataAsync() {
        let data: DataCollection;
        try {
            data = await loadAllData();
        }
        catch (error) {
            this.setState({ loadError: "Error loading data: " + error });
            return;
        }
        let yearState = { year: MAX_YEAR };
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

    onStateCleared = () => {
        this.setState({ selectedStateCode: undefined });
    }

    setStateFromHash = () => {
        if (location.hash.length > 1) {
            let hashPartsArray = location.hash.substr(1).split('&').map(x => x.split('='));
            let hashParts = new Map<string, string>();
            for (let i = 0; i < hashPartsArray.length; ++i) {
                hashParts.set(hashPartsArray[i][0], hashPartsArray[i][1]);
            }
            let newState = {};
            if (hashParts.has("year")) {
                let newYear = parseInt(hashParts.get("year"), 10);
                if (!isNullOrUndefined(newYear) && !isNaN(newYear)) {
                    if (newYear >= MIN_YEAR && newYear <= MAX_YEAR && ((newYear - MIN_YEAR) % YEAR_STEP === 0)) {
                        newState['year'] = newYear;
                    }
                }
            }
            if (hashParts.has("state")) {
                let stateCode = hashParts.get("state");
                if (this.state.stateInfos.codeToStateName.has(stateCode)) {
                    newState['selectedStateCode'] = stateCode;
                }
            }
            if (hashParts.has("cartogram")) {
                let num = parseInt(hashParts.get("cartogram"), 10);
                if (num === 1) {
                    newState['isCartogram'] = true;
                }
                else if (num === 0) {
                    newState['isCartogram'] = false;
                }
            }
            if (hashParts.has("actualResults")) {
                let num = parseInt(hashParts.get("actualResults"), 10);
                if (num === 1) {
                    newState['rawResults'] = true;
                }
                else if (num === 0) {
                    newState['rawResults'] = false;
                }
            }
            this.setState(newState);
        }
        this.setState({ haveUpdatedFromHash: true });
    }

    static _appendToHash(hash: string, toAppend: string) {
        if (isNullOrUndefined(hash)) {
            return '#' + toAppend;
        }
        return hash + '&' + toAppend;
    }

    updateHash = () => {
        let newHash = undefined;
        if (this.state.year != MAX_YEAR) {
            newHash = App._appendToHash(newHash, `year=${this.state.year}`);
        }
        if (!isNullOrUndefined(this.state.selectedStateCode)) {
            newHash = App._appendToHash(newHash, `state=${this.state.selectedStateCode}`);
        }
        newHash = App._appendToHash(newHash, `cartogram=${this.state.isCartogram ? 1 : 0}&actualResults=${this.state.rawResults ? 1 : 0}`);
        window.location.hash = newHash;
    }

    dataHasLoaded = () => {
        return this.state.stateInfos && this.state.year;
    }

    errorStringFromError = (error: any) => {
        // JS exceptions have this
        if (error.hasOwnProperty("message")) {
            return error.message;
        }
        return error;
    }

    render = () => {
        if (!isNullOrUndefined(this.state.loadError)) {
            return <div className="App" style={{ backgroundColor: "red"}}>{this.errorStringFromError(this.state.loadError)}</div>;
        }
        if (!(this.dataHasLoaded())) {
            return <div className="App">Loading</div>;
        }
        if (this.state.haveUpdatedFromHash) {
            this.updateHash();
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
                let dAdvantage = this.dAdvantageFromVotes(stateData, baselineDAdvantage);
                stateColors.set(stateCode, this.colorFromDAndRVote(stateData.dCount, stateData.rCount, stateData.totalCount, baselineDAdvantage));
                stateTitles.set(stateCode, this.textFromDAdvantage(dAdvantage) + "\n" + (this.state.rawResults ? "Actual results" : "Relative to popular vote"));
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
            //let yMin = Math.min(0, min);
            //let yMax = Math.max(0, max);
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

        return (
            <div className="App">
                <StateMap isCartogram={this.state.isCartogram}
                    stateColors={stateColors}
                    stateTitles={stateTitles}
                    stateSelectedCallback={this.onStateSelected}
                    stateClearedCallback={this.onStateCleared}
                    x={0}
                    y={0}
                    width={900}
                    height={500}
                    onError={this.onMapError} />
                <div>
                    <Button.Group>
                        <Button active={this.state.rawResults} onClick={() => this.setState({ rawResults: true })}>Actual results</Button>
                        <Button.Or />
                        <Button active={!this.state.rawResults} onClick={() => this.setState({ rawResults: false })}>Relative to popular vote</Button>
                    </Button.Group>
                </div>
                <div style={{ marginTop: "5px" }}>
                    <Button.Group>
                        <Button active={!this.state.isCartogram} onClick={() => this.setState({ isCartogram: false })}>Normal</Button>
                        <Button.Or />
                        <Button active={this.state.isCartogram} onClick={() => this.setState({ isCartogram: true })}>Cartogram</Button>
                    </Button.Group>
                </div>
                <div>Year <b>{this.state.year}</b> Popular vote: <b>{this.textFromDAdvantage(nationalDAdvantage)}</b></div>
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

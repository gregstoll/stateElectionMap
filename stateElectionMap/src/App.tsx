import * as React from 'react';
import { Button } from 'semantic-ui-react';
import * as _ from 'lodash';
import { loadAllData, DataCollection, StateInfos, ElectionData, ElectoralVoteData, MinVotesToChangeResultData, MIN_YEAR, MAX_YEAR, YEAR_STEP, DataUtils, Utils } from './DataHandling';
import { USStateMap, DateSlider, TickDateRange } from 'us-state-map';
import { LineChart, BarChart } from 'react-chartkick';
import ReactChartkick from 'react-chartkick';
import Chart from 'chart.js';

import 'rc-slider/assets/index.css';
import './App.css';

const SHOW_ELECTORAL_VOTES = process.env.NODE_ENV !== "production";

ReactChartkick.addAdapter(Chart);

interface AppState {
    year: number,
    selectedStateCode: string,
    rawResults: boolean,
    isCartogram: boolean,
    stateInfos: StateInfos,
    electionData: ElectionData,
    electoralVoteData: ElectoralVoteData,
    minVotesToChangeResultData: MinVotesToChangeResultData,
    haveUpdatedFromHash: boolean,
    loadError: string
}

class App extends React.Component<{}, AppState> {
    state: AppState = {
        year: 0,
        selectedStateCode: undefined,
        isCartogram: true,
        rawResults: true,
        stateInfos: null,
        electionData: null,
        electoralVoteData: null,
        minVotesToChangeResultData: null,
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

    onSliderDateChange = (date: TickDateRange) => {
        if (SHOW_ELECTORAL_VOTES) {
            this.setState({ year: date.endYear, selectedStateCode: undefined});
        }
        else {
            this.setState({ year: date.endYear });
        }
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
                if (newYear !== null && newYear !== undefined && !isNaN(newYear)) {
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
        if (hash === null || hash === undefined) {
            return '#' + toAppend;
        }
        return hash + '&' + toAppend;
    }

    updateHash = () => {
        let newHash = undefined;
        if (this.state.year != MAX_YEAR) {
            newHash = App._appendToHash(newHash, `year=${this.state.year}`);
        }
        if (this.state.selectedStateCode !== null && this.state.selectedStateCode !== undefined) {
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
        if (this.state.loadError !== undefined) {
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
        let belowMapSection = undefined;
        let electionData = this.state.electionData.get(this.state.year);
        let nationalDAdvantage = electionData.nationalDAdvantage;
        let baselineDAdvantage = this.state.rawResults ? 0 : electionData.nationalDAdvantage;
        //TODO - performance https://stackoverflow.com/questions/37699320/iterating-over-typescript-map
        let a = Array.from(this.state.stateInfos.codeToStateName.entries());
        for (let [stateCode, value] of a) {
            let stateData = electionData.stateResults.get(stateCode);
            if (stateData) {
                let dAdvantage = Utils.dAdvantageFromVotes(stateData, baselineDAdvantage);
                stateColors.set(stateCode, Utils.colorFromDAdvantage(dAdvantage));
                stateTitles.set(stateCode, Utils.textFromDAdvantage(dAdvantage) + "\n" + (this.state.rawResults ? "Actual results" : "Relative to popular vote"));
            }
        }

        if (this.state.selectedStateCode) {
            let data = {};
            let min = 0, max = 0;
            for (let year = MIN_YEAR; year <= MAX_YEAR; year += YEAR_STEP) {
                let yearElectionData = this.state.electionData.get(year);
                let yearBaselineDAdvantage = this.state.rawResults ? 0 : yearElectionData.nationalDAdvantage;
                let stateData = yearElectionData.stateResults.get(this.state.selectedStateCode);
                let y = Utils.dAdvantageFromVotes(stateData, yearBaselineDAdvantage);
                data[year] = y;

                min = Math.min(min, y);
                max = Math.max(max, y);
            }
            min = Math.floor(min / 5) * 5;
            max = Math.ceil(max / 5) * 5;
            let stateNameObj = this.state.stateInfos.codeToStateName.get(this.state.selectedStateCode);
            //let yMin = Math.min(0, min);
            //let yMax = Math.max(0, max);
            belowMapSection = <div style={{ width: 500 }} className="centerFixedWidth">{stateNameObj.name}
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
                                            return "Even";
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
        else if (SHOW_ELECTORAL_VOTES) {
            const results = DataUtils.getTotalDAndRElectoralVotes(this.state.electoralVoteData, this.state.electionData, this.state.year);
            let barChart = undefined;
            if (this.state.year > MIN_YEAR) {
                // gather change from last election
                const thisYearElectionData = this.state.electionData.get(this.state.year);
                const lastYearElectionData = this.state.electionData.get(this.state.year - 4);
                const thisYearBaselineAdvantage = this.state.rawResults ? 0 : thisYearElectionData.nationalDAdvantage;
                const lastYearBaselineAdvantage = this.state.rawResults ? 0 : lastYearElectionData.nationalDAdvantage;
                let stateDDifferences: Array<[number, string]> = [];
                const thisYearEntries = Array.from(thisYearElectionData.stateResults.entries());
                for (let [state, thisYearResult] of thisYearEntries) {
                    const dDiff = Utils.dAdvantageFromVotes(thisYearResult, thisYearBaselineAdvantage) - Utils.dAdvantageFromVotes(lastYearElectionData.stateResults.get(state), lastYearBaselineAdvantage);
                    stateDDifferences.push([dDiff, state]);
                }
                stateDDifferences.sort((a, b) => b[0] - a[0]);
                let entries = [];
                let colors = [];
                for (let [dDiff, state] of stateDDifferences) {
                    entries.push([state, dDiff]);
                    colors.push(Utils.colorFromDAdvantage(dDiff));
                }
                const xTitle = this.state.rawResults ? "Actual change from last election" : "Relative change from last election";
                const tooltipDescription = this.state.rawResults ? "" : "(relative change)";
                const codeToStateName = this.state.stateInfos.codeToStateName;
                // the double array of colors makes chart.js use one color per bar
                barChart = <BarChart width={500} height={800} data={entries} colors={[colors]}
                        xtitle={xTitle}
                        library={{
                            scales: {
                                xAxes: [{
                                    ticks: {
                                        callback: function (value, index, values) {
                                            if (value > 0) {
                                                return "D+" + value;
                                            }
                                            else if (value < 0) {
                                                return "R+" + (-1 * value);
                                            }
                                            else {
                                                return "Even";
                                            }
                                        }
                                    },
                                    position: "top"
                                }]
                            },
                            tooltips: {
                                callbacks: {
                                    title: function (tooltipItems, data){
                                        // show state name instead of code here
                                        return codeToStateName.get(tooltipItems[0].yLabel).name;
                                    },
                                    label: function (tooltipItem, data) {
                                        let valueText = "Even";
                                        if (tooltipItem.xLabel > 0) {
                                            valueText = "D+" + tooltipItem.xLabel.toFixed(1) + "%";
                                        }
                                        else if (tooltipItem.xLabel < 0) {
                                            valueText = "R+" + (-1 * tooltipItem.xLabel).toFixed(1) + "%";
                                        }
                                        valueText += "\n" + tooltipDescription;
                                        return valueText;
                                    }
                                }
                            }
                        }}
                        />;
            }
            const winnerText = results.dElectoralVotes > results.rElectoralVotes ? "D" : "R";
            const loserText = results.dElectoralVotes > results.rElectoralVotes ? "R" : "D";
            const winnerVotes = Math.max(results.dElectoralVotes, results.rElectoralVotes);
            const loserVotes = Math.min(results.dElectoralVotes, results.rElectoralVotes);
            const evText = `Electoral votes: ${winnerText} ${winnerVotes} - ${loserText} ${loserVotes}`;
            const tippingPointState = DataUtils.getTippingPointState(this.state.electoralVoteData, this.state.electionData, this.state.year);
            const closestState = DataUtils.getClosestStateByPercentage(this.state.electionData, this.state.year);
            let minVotesData = this.state.minVotesToChangeResultData.get(this.state.year);
            minVotesData.sort();
            const yearStateResults = this.state.electionData.get(this.state.year).stateResults;
            const minVotesNumber = minVotesData.
                map(stateCode => DataUtils.getNumberOfVotesToChangeWinner(yearStateResults.get(stateCode))).
                reduce((a, b) => a + b, 0);
            const minVoteListItems = minVotesData.
                map(stateCode => <li key={stateCode} className="listInColumn">
                    {this.state.stateInfos.codeToStateName.get(stateCode).name}: {DataUtils.getNumberOfVotesToChangeWinner(yearStateResults.get(stateCode)).toLocaleString()} votes
                    ({DataUtils.getElectoralVotesForState(this.state.electoralVoteData, stateCode, this.state.year)} EV)
                    </li>)
            belowMapSection = <div style={{ width: 500 }} className="centerFixedWidth">{evText}
                <br/>
                Tipping point state: {this.state.stateInfos.codeToStateName.get(tippingPointState.stateCode).name} {Utils.textFromDAdvantage(Utils.dAdvantageFromVotes(tippingPointState))}
                <br/>
                Closest state (by percentage): {this.state.stateInfos.codeToStateName.get(closestState.stateCode).name} {Utils.textFromDAdvantage(Utils.dAdvantageFromVotes(closestState))}
                <br/>
                Minimum number of additional {loserText} votes so {loserText} would have won: {minVotesNumber.toLocaleString()}
                <ul className="listInColumn">
                    {minVoteListItems}
                </ul>
                {barChart}
                </div>;
        }

        return (
            <div className="App">
                <USStateMap isCartogram={this.state.isCartogram}
                    stateColors={stateColors}
                    stateTitles={stateTitles}
                    stateSelectedCallback={this.onStateSelected}
                    stateClearedCallback={this.onStateCleared}
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
                <div>Year <b>{this.state.year}</b> Popular vote: <b>{Utils.textFromDAdvantage(nationalDAdvantage)}</b></div>
                <div style={{ width: 500 }} className="centerFixedWidth">
                    <DateSlider
                        yearsPerTick={YEAR_STEP}
                        startTickDateRange={new TickDateRange(MIN_YEAR)}
                        endTickDateRange={new TickDateRange(MAX_YEAR)}
                        currentTickDateRange={new TickDateRange(this.state.year)}
                        onTickDateRangeChange={this.onSliderDateChange} />
                </div>
                {belowMapSection}
            </div>
        );
    }
}

export default App;

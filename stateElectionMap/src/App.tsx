import React, { Component } from 'react';
import { StateMap } from './StateMap';
import { Button } from 'semantic-ui-react';
import _ from 'lodash';
import { loadAllData, DataCollection, StateName, ElectionData, MIN_YEAR, MAX_YEAR, YEAR_STEP } from './DataHandling';
import Slider, { createSliderWithTooltip} from 'rc-slider';

import 'rc-slider/assets/index.css';
import './App.css';

interface AppState {
    year: number,
    rawResults: boolean,
    //TODO - figure out this type and use it everywhere
    usTopoJson: any,
    stateNames: StateName[],
    electionData: ElectionData
}

class App extends Component<{}, AppState> {
    state : AppState = {
        year: 0,
        rawResults: true,
        usTopoJson: null,
        stateNames: null,
        electionData: null
    };

    componentDidMount() {
        this.loadDataAsync();
    }

    async loadDataAsync() {
        let data: DataCollection = await loadAllData();
        let yearState = {year: parseInt(_.min(Object.keys(data.electionData)), 10)};
        this.setState(Object.assign(yearState, data));
    }

    colorFromDAndRVote(dVote: number, rVote: number, baselineDPercentage = 50) {
        // http://colorbrewer2.org/?type=diverging&scheme=RdBu&n=11
        const _colors =
            ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#f7f7f7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac', '#053061'];
        
        let dPercentage = (dVote * 100.0) / (dVote + rVote);
        // 5 red, 5 blue (don't use middle one)
        const increment = 3;
        if (dPercentage < baselineDPercentage - 4 * increment) {
            return _colors[0];
        }
        if (dPercentage < baselineDPercentage - 3 * increment) {
            return _colors[1];
        }
        if (dPercentage < baselineDPercentage - 2 * increment) {
            return _colors[2];
        }
        if (dPercentage < baselineDPercentage - 1 * increment) {
            return _colors[3];
        }
        if (dPercentage < baselineDPercentage) {
            return _colors[4];
        }

        if (dPercentage > baselineDPercentage + 4 * increment) {
            return _colors[10];
        }
        if (dPercentage > baselineDPercentage + 3 * increment) {
            return _colors[9];
        }
        if (dPercentage > baselineDPercentage + 2 * increment) {
            return _colors[8];
        }
        if (dPercentage > baselineDPercentage + increment) {
            return _colors[7];
        }
        return _colors[6];
    }

    textFromDPercentage(dPercentage: number, baselineDPercentage = 50) {
        if (dPercentage > baselineDPercentage) {
            return "D +" + (dPercentage - baselineDPercentage).toFixed(1) + "%";
        }
        if (dPercentage < baselineDPercentage) {
            return "R +" + (baselineDPercentage - dPercentage).toFixed(1) + "%";
        }
        return "Even";
    }

    onSliderChange = (value) => {
        this.setState({ year: value });
    }

    render() {
      if (!this.state.usTopoJson) {
          return <div>Loading</div>;
      }

    let stateColors = new Map<string, string>();
    let nationalDPercentage = 50;
    if (this.state.stateNames && this.state.year) {
        let electionData = this.state.electionData[this.state.year];
        let dTotal = 0, rTotal = 0;
        electionData.forEach(value => {
            dTotal += value.dCount;
            rTotal += value.rCount;
        });
        nationalDPercentage = (dTotal * 100.0) / (dTotal + rTotal);
        let baselineDPercentage = (this.state.rawResults) ? 50 : nationalDPercentage;
        for (let i in this.state.stateNames) {
            let stateCode = this.state.stateNames[i].code;
            //TODO optimize
            let stateData = _.find(electionData, electionDataObj => electionDataObj.stateCode === stateCode);
            if (stateData) {
                // TODO - cooler stuff
                stateColors[stateCode] = this.colorFromDAndRVote(stateData.dCount, stateData.rCount, baselineDPercentage);
            }
        }
    }

        // https://react-component.github.io/slider/examples/slider.html
      return (
          <div className="App">
            <svg width="1100" height="500">
                <StateMap usTopoJson={this.state.usTopoJson}
                          stateNames={this.state.stateNames}
                          stateColors={stateColors}
                          x={0}
                          y={0}
                          width={500}
                          height={500}/>
              </svg>
              <div>
                  <Button.Group>
                      <Button active={this.state.rawResults} onClick={() => this.setState({ rawResults: true })}>Actual results</Button>
                      <Button active={!this.state.rawResults} onClick={() => this.setState({ rawResults: false })}>Relative to popular vote</Button>
                  </Button.Group>
              </div>
              <div>Year {this.state.year} Popular vote: {this.textFromDPercentage(nationalDPercentage, 100 - nationalDPercentage)}</div>
            <div style={{width: 500}}>
                <Slider min={MIN_YEAR} max={MAX_YEAR} step={YEAR_STEP} value={this.state.year} onChange={this.onSliderChange}/>
            </div>

          </div>
      );
  }
}

export default App;

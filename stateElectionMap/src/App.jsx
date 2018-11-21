import React, { Component } from 'react';
import StateMap from './StateMap';
import _ from 'lodash';
import { loadAllData } from './DataHandling';
import Slider, { createSliderWithTooltip} from 'rc-slider';

import 'rc-slider/assets/index.css';
import './App.css';

class App extends Component {
    state = {
    };

    componentDidMount() {
        loadAllData(data => {
            let yearState = {year: _.min(Object.keys(data.electionData))};
            this.setState(Object.assign(yearState, data));
        });
    }

    colorFromDAndRVote(dVote, rVote) {
        // http://colorbrewer2.org/?type=diverging&scheme=RdBu&n=11
        const _colors =
            ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#f7f7f7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac', '#053061'];
        
        let dPercentage = (dVote * 100.0) / (dVote + rVote);
        // 5 red, 5 blue (don't use middle one)
        const increment = 3;
        if (dPercentage < 50 - 4 * increment) {
            return _colors[0];
        }
        if (dPercentage < 50 - 3 * increment) {
            return _colors[1];
        }
        if (dPercentage < 50 - 2 * increment) {
            return _colors[2];
        }
        if (dPercentage < 50 - 1 * increment) {
            return _colors[3];
        }
        if (dPercentage < 50) {
            return _colors[4];
        }

        if (dPercentage > 50 + 4 * increment) {
            return _colors[10];
        }
        if (dPercentage > 50 + 3 * increment) {
            return _colors[9];
        }
        if (dPercentage > 50 + 2 * increment) {
            return _colors[8];
        }
        if (dPercentage > 50 + increment) {
            return _colors[7];
        }
        return _colors[6];
    }

    onSliderChange = (value) => {
        this.setState({ year: value });
    }

    render() {
      if (!this.state.usTopoJson) {
          return <div>Loading</div>;
      }

    let stateColors = new Map();
    if (this.state.usStateNames && this.state.year) {
        for (let i in this.state.usStateNames) {
            let stateCode = this.state.usStateNames[i].code;
            //TODO optimize
            let stateData = _.find(this.state.electionData[this.state.year], electionDataObj => electionDataObj.stateCode === stateCode);
            if (stateData) {
                // TODO - cooler stuff
                stateColors[stateCode] = this.colorFromDAndRVote(stateData.dCount, stateData.rCount);
            }
        }
    }

        // https://react-component.github.io/slider/examples/slider.html
      return (
          <div className="App">
            <svg width="1100" height="500">
                <StateMap usTopoJson={this.state.usTopoJson}
                          usStateNames={this.state.usStateNames}
                          stateColors={stateColors}
                          x={0}
                          y={0}
                          width={500}
                          height={500}/>
            </svg>
            <div>Year {this.state.year}</div>
            <div style={{width: 500}}>
                <Slider min={2000} max={2016} step={4} value={parseInt(this.state.year, 10)} onChange={this.onSliderChange}/>
            </div>

          </div>
      );
  }
}

export default App;

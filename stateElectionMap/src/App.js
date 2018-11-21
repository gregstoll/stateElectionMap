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
                stateColors[stateCode] = stateData.rCount > stateData.dCount ? '#ff0000' : '#0000ff';
            }
        }
    }

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
                <Slider min={2008} max={2016} step={4} value={parseInt(this.state.year, 10)} onChange={this.onSliderChange}/>
            </div>

          </div>
      );
  }
}

export default App;

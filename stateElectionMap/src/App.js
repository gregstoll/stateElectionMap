import React, { Component } from 'react';
import StateMap from './StateMap';
import './App.css';
import _ from 'lodash';
import { loadAllData } from './DataHandling';

class App extends Component {
    state = {
    };

    changeColors() {
        if (this.state.usStateNames && this.state.year) {
            let stateColors = new Map();
            for (let i in this.state.usStateNames) {
                let stateCode = this.state.usStateNames[i].code;
                //TODO optimize
                let stateData = _.find(this.state.electionData[this.state.year], electionDataObj => electionDataObj.stateCode === stateCode);
                if (stateData) {
                    stateColors[stateCode] = stateData.rCount > stateData.dCount ? '#ff0000' : '#0000ff';
                }
            }
            this.setState({ stateColors: stateColors });
        }
    }

    componentDidMount() {
        loadAllData(data => {
            this.setState(data);
            this.setState({ year: _.min(Object.keys(data.electionData)) });
            this.changeColors();
        });
    }

    render() {
      if (!this.state.usTopoJson) {
          return <div>Loading</div>;
      }

      return (
          <div className="App">
              <div>Year {this.state.year}</div>
            <svg width="1100" height="500">
                <StateMap usTopoJson={this.state.usTopoJson}
                          usStateNames={this.state.usStateNames}
                          stateColors={this.state.stateColors}
                          electionData={this.state.electionData}
                          x={0}
                          y={0}
                          width={500}
                          height={500}/>
            </svg>

          </div>
      );
  }
}

export default App;

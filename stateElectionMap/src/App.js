import React, { Component } from 'react';
import StateMap from './StateMap';
import './App.css';
import _ from 'lodash';
import { loadAllData } from './DataHandling';

class App extends Component {
    state = {
    }

    componentDidMount() {
        loadAllData(data => this.setState(data));
    }

    render() {
      if (!this.state.usTopoJson) {
          return <div>Loading</div>;
      }

      return (
          <div className="App">
            <svg width="1100" height="500">
                <StateMap usTopoJson={this.state.usTopoJson}
                          usStateNames={this.state.usStateNames}
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

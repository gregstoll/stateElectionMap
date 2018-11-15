import React, { Component } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson'

class StateMap extends Component {
    constructor(props) {
        super(props);

        this.projection = d3.geoAlbersUsa().scale(1280);
        this.geoPath = d3.geoPath();
        this.quantize = d3.scaleQuantize().range(d3.range(9));

        this.updateD3(props);
    }

    updateD3(props) {
        //TODO
    }

    render() {
        const us = this.props.usTopoJson;
        const statesMesh = topojson.mesh(us, us.objects.states, (a, b) => a !== b);

        return <g>
            <path d={this.geoPath(statesMesh)}/>
            </g>;
        return <div/>;
    }
}

export default StateMap;

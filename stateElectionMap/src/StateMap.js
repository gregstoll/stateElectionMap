import React, { Component } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson'

class StateMap extends Component {
    constructor(props) {
        super(props);

        this.projection = d3.geoAlbersUsa().scale(1280);
        this.geoPath = d3.geoPath().projection(this.projection);
        this.quantize = d3.scaleQuantize().range(d3.range(9));

        this.updateD3(props);
    }

    updateD3(props) {
        this.projection
            .translate([props.width / 2, props.height / 2])
            .scale(props.width * 1.3);
        //TODO
    }

    render() {
        const us = this.props.usTopoJson;
        //const statesMesh = topojson.mesh(us, us.objects.states, (a, b) => a !== b);
        const statesMesh = topojson.mesh(us, us.objects.states, (a, b) => true);
        // https://d3-geomap.github.io/map/choropleth/us-states/
        //const map = d3.geomap.choropleth().geofile('/d3-geomap/topojson/countries/USA.json').projection(this.projection);

        return <g transform={`translate(${this.props.x}, ${this.props.y})`}>
            <path d={this.geoPath(statesMesh)} style={{fill: 'none', stroke: '#000', strokeLinejoin: 'round'}} />
            </g>;
    }
}

export default StateMap;

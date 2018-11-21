import React, { Component } from 'react';
import * as d3 from 'd3';
import _ from 'lodash';
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
        // this does only internal lines
        //const statesMesh = topojson.mesh(us, us.objects.states, (a, b) => a !== b);
        // this does everything
        //const statesMesh = topojson.mesh(us, us.objects.states, (a, b) => true);
        // https://d3-geomap.github.io/map/choropleth/us-states/
        //const map = d3.geomap.choropleth().geofile('/d3-geomap/topojson/countries/USA.json').projection(this.projection);
        let paths = [];
        for (let i = 0; i < us.objects.states.geometries.length; ++i) {
            let topoState = us.objects.states.geometries[i];
            let stateId = topoState.id;
            // TODO optimize this
            let stateCode = _.find(this.props.usStateNames, stateNameObj => stateNameObj.id === stateId).code;
            let color = (this.props.stateColors && this.props.stateColors[stateCode]) || 'rgb(240, 240, 240)';
            let path = <path d={this.geoPath(topojson.feature(us, topoState))} style={{fill: color, stroke: '#000'}} key={stateCode} />
            paths.push(path);
        }
        // <path d={this.geoPath(statesMesh)} style={{fill: 'none', stroke: '#000', strokeLinejoin: 'round'}} />
        return <g transform={`translate(${this.props.x}, ${this.props.y})`}>
            {paths}
            </g>;
    }
}

export default StateMap;

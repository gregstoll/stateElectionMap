import React, { Component } from 'react';
import * as d3 from 'd3';
import _ from 'lodash';
import { StateName } from './DataHandling';
import * as topojson from 'topojson'
import polylabel from 'polylabel';
import { isNullOrUndefined } from 'util';

//TODO - make StateMap own the usTopoJson and cartogram stuff (including fetching it)
interface StateMapProps {
    usTopoJson: any,
    cartogram: d3.Selection<HTMLElement, () => any, null, undefined>,
    stateNames: StateName[],
    stateColors: Map<string, string>,
    stateTitles: Map<string, string>,
    stateSelectedCallback: (stateCode: string) => void,
    isCartogram: boolean,
    x: number,
    y: number,
    width: number,
    height: number
}

export class StateMap extends Component<StateMapProps, {}> {
    projection: d3.GeoProjection;
    geoPath: d3.GeoPath;
    quantize: d3.ScaleQuantize<Number>;

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

    stateClick = event => {
        let stateCode: string = event.currentTarget.attributes["name"].value;
        this.props.stateSelectedCallback(stateCode);
    };

    //TODO rename
    getPath = (stateCode: string, stateName: string, path: string): Array<JSX.Element> => {
        if (isNullOrUndefined(path)) {
            return [];
        }
        let color = (this.props.stateColors && this.props.stateColors.get(stateCode)) || 'rgb(240, 240, 240)';
        let titleExtra = this.props.stateTitles && this.props.stateTitles.get(stateCode);
        //TODO - throws for non-cartogram
        let parsedPath = this.parsePath(path);
        //TODO - this calculation returns NaN's
        let center = this.getCenters(stateCode, parsedPath);
        // TODO - don't show if not present
        let title = `${stateName}: ${titleExtra}`;
        let parts = [];
        parts.push(<path name={stateCode} d={path} style={{ fill: color, stroke: '#000' }} key={stateCode} onClick={this.stateClick}>
            <title>{title}</title>
        </path>);
        // TODO - actually center this?
        // TODO - goes behind state boundaries (see NM)
            parts.push(<text x={center[0][0]} y={center[0][1]} dy="0.25em" stroke={"black"}>{stateCode}</text>);
            return parts;
    };

    getCenters(stateCode : string, shapes: Array<Array<[number, number]>>) {
        return shapes.map(function (shape: Array<[number, number]>) {
            if (shape.length > 1 || (stateCode === "AK" || stateCode === "HI")) {
                //TODO look at AK and a bunch of others in normal mode
                //TODO is this right?
                //flattened = shape.reduce(function (prev, ring) {
                //    return prev.concat(ring);
                //}, []);
                //let hull = d3.polygonHull(flattened);
                let hull = d3.polygonHull(shape);
                return polylabel([hull]);
            }

            return polylabel([shape]);
        });
    }

    parsePath(str: string): Array<Array<[number, number]>> {
        var polys = str.replace(/^M|Z$/g, "").split("ZM").map(function (poly : string) {
            return poly.split("L").map(function (pair : string) {
                return pair.split(",").map(function (point : string) {
                    return parseFloat(point);
                });
            });
        });
        return polys as Array<Array<[number, number]>>;
    }

    render() {
        // https://d3-geomap.github.io/map/choropleth/us-states/
        //const map = d3.geomap.choropleth().geofile('/d3-geomap/topojson/countries/USA.json').projection(this.projection);
        let paths: JSX.Element[]  = [];
        if (!this.props.isCartogram) {
            const us = this.props.usTopoJson;
            const geometries = us.objects.states.geometries;
            for (let i = 0; i < geometries.length; ++i) {
                let topoState = geometries[i];
                let stateId = topoState.id;
                // TODO optimize this
                let stateNameObj = _.find(this.props.stateNames, stateNameObj => stateNameObj.id === stateId);
                let stateCode = stateNameObj.code;
                for (let path of this.getPath(stateCode, stateNameObj.name, this.geoPath(topojson.feature(us, topoState)))) {
                    paths.push(path);
                }
            }
        }
        else {
            // good glaven, thought JS was done with this tomfoolery
            let that = this;
            let svgPaths = this.props.cartogram.selectAll("path").each(function() {
                let thisPath = this as SVGPathElement;
                let stateCode = thisPath.getAttribute("id");
                // TODO optimize this
                let stateNameObj = _.find(that.props.stateNames, stateNameObj => stateNameObj.code === stateCode);
                let pathString = thisPath.getAttribute("d");
                for (let path of that.getPath(stateCode, stateNameObj.name, pathString)) {
                    paths.push(path);
                }
            });
        }
        return <g transform={`translate(${this.props.x}, ${this.props.y})`}>
            {paths}
            </g>;
    }
}
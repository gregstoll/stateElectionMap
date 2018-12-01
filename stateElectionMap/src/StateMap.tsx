import React, { Component } from 'react';
import * as d3 from 'd3';
import _ from 'lodash';
import { StateName } from './DataHandling';
import * as topojson from 'topojson'
import polylabel from 'polylabel';
import { isNullOrUndefined } from 'util';
//TODO - namespace this, sheesh
import parseColor from 'parse-color';

import './StateMap.css';

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
};

interface StateLineInfo {
    lineStart: [number, number],
    lineEnd: [number, number],
    lineTextPosition: [number, number]
};

export class StateMap extends Component<StateMapProps, {}> {
    projection: d3.GeoProjection;
    geoPath: d3.GeoPath;
    stateLines: Map<string, StateLineInfo>;

    constructor(props) {
        super(props);

        this.projection = d3.geoAlbersUsa().scale(1280);
        this.geoPath = d3.geoPath().projection(this.projection);

        this.updateD3(props);
        this.initStateLines();
    }

    initStateLines() {
        this.stateLines = new Map<string, StateLineInfo>();
        this.stateLines.set('NH', { lineStart: [384, 155], lineEnd: [407, 187], lineTextPosition: [385, 150] });
    }

    updateD3(props) {
        // TODO this does something because taking it out makes the non-cartogram look bad
        if (this.props.isCartogram) {
            this.projection
                .translate([props.width / 2, props.height / 2])
                .scale(props.width * 1.0);
        }
        else {
            this.projection
                .translate([props.width / 2, props.height / 2])
                .scale(props.width * 1.3);
        }
    }

    stateClick = event => {
        let stateCode: string = event.currentTarget.attributes["name"].value;
        this.props.stateSelectedCallback(stateCode);
    };

    getSVGPaths = (stateCode: string, stateName: string, path: string): Array<JSX.Element> => {
        if (isNullOrUndefined(path)) {
            return [];
        }
        const color = (this.props.stateColors && this.props.stateColors.get(stateCode)) || 'rgb(240, 240, 240)';
        const titleExtra = this.props.stateTitles && this.props.stateTitles.get(stateCode);
        const parsedPath = this.parsePath(path);
        const title = isNullOrUndefined(titleExtra) ? stateName : `${stateName}: ${titleExtra}`;
        let textPosition: [number, number];
        let parts = [];
        if (this.stateLines.has(stateCode)) {
            const stateLineInfo = this.stateLines.get(stateCode);
            textPosition = stateLineInfo.lineTextPosition;
            const linePath = `M ${stateLineInfo.lineStart[0]},${stateLineInfo.lineStart[1]} L ${stateLineInfo.lineEnd[0]},${stateLineInfo.lineEnd[1]} Z`;
            parts.push(<path key={stateCode + "line"} name={stateCode + "line"} d={linePath} />);
        }
        else {
            textPosition = this.getCenter(parsedPath);
        }
        parts.push(<path name={stateCode} d={path} style={{ fill: color }} key={stateCode} onClick={this.stateClick}>
            <title>{title}</title>
        </path>);
        //TODO background color on text?
        parts.push(<text name={stateCode} x={textPosition[0]} y={textPosition[1]} key={stateCode + "text"} dy="0.25em" onClick={this.stateClick} stroke={this.getLabelColor(color)}>{stateCode}</text>);
        return parts;
    };

    getLabelColor(backgroundColor: string): string {
        let backgroundParsedColor = parseColor(backgroundColor);
        let hsl: number[] = backgroundParsedColor.hsl;
        if (isNullOrUndefined(hsl)) {
            return "#222";
        }
        let l: number = hsl[2];
        if (l > 40) {
            return "#222";
        } else {
            return "#ddd";
        }
    }

    getCenter(shapes: Array<Array<[number, number]>>): [number, number] {
        if (this.props.isCartogram) {
            return polylabel([shapes[0]]) as [number, number];
        }
        else {
            // Very rough heuristic to find the "main" path
            // could look at bounding box instead
            let maxIndex: number = _.maxBy(_.range(0, shapes.length), index => shapes[index].length);
            return polylabel([shapes[maxIndex]]) as [number, number];
        }
    }

    parsePath(str: string): Array<Array<[number, number]>> {
        var polys = str.replace(/^M|Z$/g, "").split("ZM").map(function (poly: string) {
            return poly.split("L").map(function (pair: string) {
                // in Edge these are space-delimited??
                return pair.trim().replace(" ", ",").split(",").map(function (xOrY: string) {
                    return parseFloat(xOrY);
                });
            });
        });
        return polys as Array<Array<[number, number]>>;
    }

    render() {
        // https://d3-geomap.github.io/map/choropleth/us-states/
        //const map = d3.geomap.choropleth().geofile('/d3-geomap/topojson/countries/USA.json').projection(this.projection);
        let paths: JSX.Element[] = [];
        let scale = 1, xOffset = 0, yOffset = 0;
        if (!this.props.isCartogram) {
            const us = this.props.usTopoJson;
            scale = 1.75;
            yOffset = -50 * scale;
            const geometries = us.objects.states.geometries;
            for (let i = 0; i < geometries.length; ++i) {
                let topoState = geometries[i];
                let stateId = topoState.id;
                // TODO optimize this
                let stateNameObj = _.find(this.props.stateNames, stateNameObj => stateNameObj.id === stateId);
                let stateCode = stateNameObj.code;
                for (let path of this.getSVGPaths(stateCode, stateNameObj.name, this.geoPath(topojson.feature(us, topoState)))) {
                    paths.push(path);
                }
            }
        }
        else {
            // good glaven, thought JS was done with this tomfoolery
            let that = this;
            let svgPaths = this.props.cartogram.selectAll("path").each(function () {
                let thisPath = this as SVGPathElement;
                let stateCode = thisPath.getAttribute("id");
                // TODO optimize this
                let stateNameObj = _.find(that.props.stateNames, stateNameObj => stateNameObj.code === stateCode);
                let pathString = thisPath.getAttribute("d");
                for (let path of that.getSVGPaths(stateCode, stateNameObj.name, pathString)) {
                    paths.push(path);
                }
            });
        }
        // Make text elements go to the end so they draw on top
        // first normal paths, then lines (pointing to text), then text
        let getPathValue = (x: JSX.Element): number => {
            if (x.type == 'text') {
                return 0;
            }
            // must be a path
            let name = x.props.name;
            if (name.endsWith("line")) {
                return 1;
            }
            return 2;
        }
        paths.sort((a, b) => {
            // first normal paths, then lines (pointing to text), then text
            let aValue = getPathValue(a);
            let bValue = getPathValue(b);
            if (aValue > bValue) {
                return -1;
            }
            if (aValue < bValue) {
                return 1;
            }
            return 0;
            //let aIsText = a.type == 'text';
            //let bIsText = b.type == 'text';
            //if (aIsText && !bIsText) {
            //    return 1;
            //}
            //if (!aIsText && bIsText) {
            //    return -1;
            //}
            //return 0;
        });
        return <g transform={`scale(${scale} ${scale}) translate(${this.props.x + xOffset}, ${this.props.y + yOffset})`}>
            {paths}
        </g>;
    }
}
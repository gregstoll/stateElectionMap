import React, { Component } from 'react';
import * as d3 from 'd3';
import _ from 'lodash';
import { StateName, StateInfos } from './DataHandling';
import * as topojson from 'topojson'
import polylabel from 'polylabel';
import { isNullOrUndefined } from 'util';
import parseColor from 'parse-color';

import './StateMap.css';

interface StateMapProps {
    stateColors: Map<string, string>,
    stateTitles: Map<string, string>,
    stateSelectedCallback: (stateCode: string) => void,
    stateClearedCallback: () => void,
    isCartogram: boolean,
    x: number,
    y: number,
    width: number,
    height: number,
    onError: (error: any) => void
};

interface StateMapDrawingInfo {
    usTopoJson: any,
    cartogram: d3.Selection<HTMLElement, () => any, null, undefined>,
    stateInfos: StateInfos
};

interface StateMapState {
    drawingInfo: StateMapDrawingInfo
}

interface StateLineInfo {
    lineStart: [number, number],
    lineEnd: [number, number],
    lineTextPosition: [number, number]
};

export class StateMap extends Component<StateMapProps, StateMapState>{
    projection: d3.GeoProjection;
    geoPath: d3.GeoPath;
    labelLines: Map<string, StateLineInfo>;

    constructor(props) {
        super(props);
        this.state = { drawingInfo: undefined };

        this.projection = d3.geoAlbersUsa().scale(1280);
        this.geoPath = d3.geoPath().projection(this.projection);

        this.updateD3(props);
        this.initLabelLines();
    }

    componentDidMount() {
        this.loadAllData();
    }

    private loadAllData(): void {
        this.getDataAsync().then(value => {
            this.setState({ drawingInfo: value });
        }).catch(error => {
            console.error("Error in StateMap: " + error);
            if (this.props.onError) {
                this.props.onError(error);
            }
        });
    }

    private async getDataAsync(): Promise<StateMapDrawingInfo> {
        let usPromise = d3.json('data/us.json');
        let stateNamesPromise = d3.tsv('data/us-state-names.tsv', this.cleanStateName);
        let cartogramPromise = this.getCartogramAsync();
        let us = await usPromise;
        let stateNames = await stateNamesPromise;
        let cartogram = await cartogramPromise;
        return {
            usTopoJson: us,
            cartogram: cartogram,
            stateInfos: this.makeStateInfos(stateNames)
        };
    }

    private cleanStateName(d: any): StateName {
        return {
            code: d.code,
            id: Number(d.id),
            name: d.name
        };
    }

    private makeStateInfos(names: StateName[]): StateInfos {
        let stateInfos: StateInfos = { codeToStateName: new Map<string, StateName>(), idToStateName: new Map<number, StateName>() };
        for (let name of names) {
            stateInfos.codeToStateName.set(name.code, name);
            stateInfos.idToStateName.set(name.id, name);
        }
        return stateInfos;
    }

    private async getCartogramAsync(): Promise<d3.Selection<HTMLElement, () => any, null, undefined>> {
        const xml = await d3.xml('data/cartograms/fivethirtyeight.svg', { headers: new Headers({ "Content-Type": "image/svg+xml" }) });
        //TODO error handling
        return d3.select(xml.documentElement);
    };


    initLabelLines() {
        this.labelLines = new Map<string, StateLineInfo>();
        this.labelLines.set('NH', { lineStart: [389, 155], lineEnd: [407, 187], lineTextPosition: [390, 150] });
        this.labelLines.set('VT', { lineStart: [371, 155], lineEnd: [399, 183], lineTextPosition: [372, 150] });
        this.labelLines.set('MA', { lineStart: [445, 195], lineEnd: [407, 198], lineTextPosition: [447, 195] });
        this.labelLines.set('RI', { lineStart: [445, 210], lineEnd: [410, 205], lineTextPosition: [447, 210] });
        this.labelLines.set('CT', { lineStart: [445, 225], lineEnd: [403, 206], lineTextPosition: [447, 225] });
        this.labelLines.set('NJ', { lineStart: [445, 240], lineEnd: [393, 218], lineTextPosition: [447, 240] });
        this.labelLines.set('DE', { lineStart: [445, 255], lineEnd: [391, 235], lineTextPosition: [447, 255] });
        this.labelLines.set('MD', { lineStart: [445, 270], lineEnd: [381, 230], lineTextPosition: [447, 270] });
        this.labelLines.set('DC', { lineStart: [445, 285], lineEnd: [379, 235], lineTextPosition: [447, 285] });
    }

    updateD3(props) {
        // Make the actual SVG be square, because that's how the paths (especially for Normal mode)
        // are laid out.
        let actualDimension = Math.min(props.width, props.height);
        this.projection
            .translate([actualDimension / 2, actualDimension / 2])
            .scale(actualDimension * 1.0);
    }

    stateClick = (event: React.MouseEvent<SVGElement>) => {
        let stateCode: string = event.currentTarget.attributes["name"].value;
        this.props.stateSelectedCallback(stateCode);
    };

    rootClick = (event: React.MouseEvent<SVGGElement>) => {
        // event.target is the childmost thing that got clicked on
        // (event.currentTarget is the element we registered on, which is not helpful)
        let target = event.target as SVGElement;
        if (isNullOrUndefined(target))
        {
            return;
        }
        let nameAttribute: string = target.attributes["name"];
        // TODO - this is a little brittle, I guess, it assumes that the root SVG
        // thing doesn't have a name
        if (isNullOrUndefined(nameAttribute))
        {
            this.props.stateClearedCallback();
        }
    }

    getSVGPaths = (stateCode: string, stateName: string, path: string, backgroundColors: Set<string>): Array<JSX.Element> => {
        if (isNullOrUndefined(path)) {
            return [];
        }
        const color = (this.props.stateColors && this.props.stateColors.get(stateCode)) || 'rgb(240, 240, 240)';
        const titleExtra = this.props.stateTitles && this.props.stateTitles.get(stateCode);
        const parsedPath = this.parsePath(path);
        const title = isNullOrUndefined(titleExtra) ? stateName : `${stateName}: ${titleExtra}`;
        let textPosition: [number, number];
        let parts = [];
        let filterText = "";
        // only use labelLines in non-cartogram mode - state codes fit inside all the states in cartogram mode
        if (!this.props.isCartogram && this.labelLines.has(stateCode)) {
            const labelLineInfo = this.labelLines.get(stateCode);
            textPosition = labelLineInfo.lineTextPosition;
            const linePath = `M ${labelLineInfo.lineStart[0]},${labelLineInfo.lineStart[1]} L ${labelLineInfo.lineEnd[0]},${labelLineInfo.lineEnd[1]} Z`;
            parts.push(<path key={stateCode + "line"} name={stateCode + "line"} d={linePath} className="labelLine"/>);
            backgroundColors.add(color);
            let filterName = this.filterNameFromColor(color);
            filterText = `url(#${filterName})`;
        }
        else {
            textPosition = this.getCenter(parsedPath);
        }
        parts.push(<path name={stateCode} d={path} style={{ fill: color }} key={stateCode} onClick={this.stateClick}>
            <title>{title}</title>
        </path>);
        parts.push(<text name={stateCode} x={textPosition[0]} y={textPosition[1]} key={stateCode + "text"}
            dy="0.25em" onClick={this.stateClick} stroke={this.getLabelColor(color)} filter={filterText}><title>{title}</title>{stateCode}</text>);
        return parts;
    };

    filterNameFromColor(color: string): string {
        let parsedColor = parseColor(color);
        return "color" + (parsedColor.hex as string).substr(1);
    }

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
        if (isNullOrUndefined(this.state.drawingInfo)) {
            return <div>Loading...</div>;
        }
        // https://d3-geomap.github.io/map/choropleth/us-states/
        //const map = d3.geomap.choropleth().geofile('/d3-geomap/topojson/countries/USA.json').projection(this.projection);
        let paths: JSX.Element[] = [];
        let backgroundColors = new Set<string>();
        let scale = 1, xOffset = 0, yOffset = 0;
        if (!this.props.isCartogram) {
            const us = this.state.drawingInfo.usTopoJson;
            scale = 1.75;
            yOffset = -50 * scale;
            const geometries = us.objects.states.geometries;
            for (let i = 0; i < geometries.length; ++i) {
                let topoState = geometries[i];
                let stateId = topoState.id;
                let stateNameObj = this.state.drawingInfo.stateInfos.idToStateName.get(stateId);
                let stateCode = stateNameObj.code;
                for (let path of this.getSVGPaths(stateCode, stateNameObj.name, this.geoPath(topojson.feature(us, topoState)), backgroundColors)) {
                    paths.push(path);
                }
            }
        }
        else {
            let that = this;
            let svgPaths = this.state.drawingInfo.cartogram.selectAll("path").each(function () {
                let thisPath = this as SVGPathElement;
                let stateCode = thisPath.getAttribute("id");
                let stateNameObj = that.state.drawingInfo.stateInfos.codeToStateName.get(stateCode);
                let pathString = thisPath.getAttribute("d");
                for (let path of that.getSVGPaths(stateCode, stateNameObj.name, pathString, backgroundColors)) {
                    paths.push(path);
                }
            });
        }
        // Make text elements go to the end so they draw on top
        // first normal paths, then text background, then lines (pointing to text), then text
        let getPathValue = (x: JSX.Element): number => {
            if (x.type == 'text') {
                if (x.props.name.endsWith("textBackground")) {
                    return 2;
                }
                return 0;
            }
            // must be a path
            let name = x.props.name;
            if (name.endsWith("line")) {
                return 1;
            }
            return 3;
        }
        paths.sort((a, b) => {
            let aValue = getPathValue(a);
            let bValue = getPathValue(b);
            if (aValue > bValue) {
                return -1;
            }
            if (aValue < bValue) {
                return 1;
            }
            return 0;
        });
        let filters: JSX.Element[] = [];
        for (let color of Array.from(backgroundColors.values())) {
            let filterName = this.filterNameFromColor(color);
            filters.push(<filter x="0" y="0" width="1" height="1" id={filterName} key={filterName}>
                <feFlood floodColor={color} />
                <feComposite in="SourceGraphic" />
            </filter>);
        }
        return <svg width={this.props.width} height={this.props.height} onClick={this.rootClick}>
            <g transform={`scale(${scale} ${scale}) translate(${this.props.x + xOffset}, ${this.props.y + yOffset})`} onClick={this.rootClick}>
                <defs>
                    {filters}
                </defs>
                {paths}
            </g>
        </svg>;
    }
}

import React, { Component } from 'react';
import { Button, Select } from 'semantic-ui-react';
import _ from 'lodash';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { isUndefined } from 'util';

export interface MapDateSliderProps {
    // Exactly one of this and yearsPerTick should be defined (the other should be undefined)
    ticksPerYear: number,
    // Exactly one of this and ticksPerYear should be defined (the other should be undefined)
    yearsPerTick: number,
    startDate: MapDate,
    endDate: MapDate,
    currentDate: MapDate,
    onDateChange: (MapDate) => void
}

export class MapDate {
    public readonly year: number;
    // 0 indexed
    public readonly endMonth: number
    constructor(year: number, endMonth: number) {
        this.year = year;
        if (endMonth < 0 || endMonth > 11) {
            throw `endMonth is out of range (must be >= 0 and < 12, got ${endMonth})`;
        }
        this.endMonth = endMonth;
    }
    equals(other: MapDate): boolean {
        return this.year == other.year && this.endMonth == other.endMonth;
    }
}

interface MapDateSliderState {
    isPlaying: boolean,
    playSpeed: number
}

export class MapDateSlider extends Component<MapDateSliderProps, MapDateSliderState> {
    constructor(props) {
        super(props);
        if ((this.props.ticksPerYear === undefined) == (this.props.yearsPerTick === undefined)) {
            console.error("Exactly one of MapDateSlider's ticksPerYear and yearsPerTick should be defined!");
            throw "Exactly one of MapDateSlider's ticksPerYear and yearsPerTick should be defined!";
        }
        this.state = { isPlaying: false, playSpeed: MapDateSlider.speedOptions()[2].value };
    }

    monthChangePerTick() {
        if (isUndefined(this.props.ticksPerYear)) {
            return this.props.yearsPerTick * 12;
        }
        else {
            return 12 / this.props.ticksPerYear;
        }
    }
    sliderIndexToMapDate(sliderIndex: number): MapDate {
        let newMonth = this.props.startDate.endMonth + this.monthChangePerTick() * sliderIndex;
        return new MapDate(this.props.startDate.year + Math.floor(newMonth / 12), newMonth % 12);
    }
    mapDateToSliderIndex(mapDate: MapDate): number {
        let yearDifference = mapDate.year - this.props.startDate.year;
        let monthDifference = mapDate.endMonth - this.props.startDate.endMonth;
        let totalMonthDifference = 12 * yearDifference + monthDifference;
        return totalMonthDifference / this.monthChangePerTick();
    }
    onSliderChange = (value: number) => {
        this.props.onDateChange(this.sliderIndexToMapDate(value));
    }
    advanceDate = () => {
        if (!this.state.isPlaying) {
            return;
        }
        //TODO - is this a race condition when we start playing from the end?
        if (this.sliderAtEnd()) {
            this.setState({ isPlaying: false });
            return;
        }
        // advance date
        let currentSliderIndex = this.mapDateToSliderIndex(this.props.currentDate);
        let newDate = this.sliderIndexToMapDate(currentSliderIndex + 1);
        this.props.onDateChange(newDate);
        this.callAdvanceDateInFuture();
    }
    callAdvanceDateInFuture = () => {
        setTimeout(this.advanceDate, this.state.playSpeed);
    }
    sliderAtEnd(): boolean {
        return this.props.currentDate.equals(this.props.endDate);
    }
    clickStopPlayButton = () => {
        if (this.state.isPlaying) {
            this.setState({ isPlaying: false });
        } else {
            this.setState({ isPlaying: true });
            if (this.sliderAtEnd()) {
                this.props.onDateChange(this.props.startDate);
            }
            this.callAdvanceDateInFuture();
        }
    }

    static speedOptions() {
        return [{ key: 'verySlow', value: 2500, text: "Very slow" },
            { key: 'slow', value: 1250, text: "Slow" },
            { key: 'normal', value: 500, text: "Normal" },
            { key: 'fast', value: 250, text: "Fast" },
            { key: 'veryFast', value: 0, text: "Very fast" }];
    }

    changeSpeed = (event, { value } ) => {
        this.setState({ playSpeed: value });
    }

    render() {
        // https://react-component.github.io/slider/examples/slider.html
        return (
            <div style={{ width: 500 }} className="centerFixedWidth">
                <Slider min={0} max={this.mapDateToSliderIndex(this.props.endDate)} step={1} value={this.mapDateToSliderIndex(this.props.currentDate)} onChange={this.onSliderChange} />
                <div>
                    <Button onClick={() => this.clickStopPlayButton()}>{this.state.isPlaying ? "Stop" : "Play"}</Button>
                    Speed: <Select options={MapDateSlider.speedOptions()} value={this.state.playSpeed} onChange={this.changeSpeed} />
                </div>
            </div>
        );
    }
}

import React, { Component } from 'react';
import { Button } from 'semantic-ui-react';
import _ from 'lodash';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { isUndefined } from 'util';

export interface MapDateSliderProps {
    // Exactly one of this and yearsPerTick should be defined (the other should be undefined)
    //TODO enforce this?
    ticksPerYear: number,
    // Exactly one of this and ticksPerYear should be defined (the other should be undefined)
    yearsPerTick: number,
    startDate: MapDate,
    endDate: MapDate,
    currentDate: MapDate,
    onDateChange: (MapDate) => void
}

export interface MapDate {
    year: number,
    // 0 indexed (verify this is in range)
    endMonth: number
}

interface MapDateSliderState {
    isPlaying: boolean
}

export class MapDateSlider extends Component<MapDateSliderProps, MapDateSliderState> {
    constructor(props) {
        super(props);
        this.state = { isPlaying: false };
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
        return { year: this.props.startDate.year + Math.floor(newMonth / 12), endMonth: newMonth % 12 };
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
        //TODO - setting for speed
        setTimeout(this.advanceDate, 500);
    }
    sliderAtEnd(): boolean {
        //TODO - better way to check equals?
        return (this.props.currentDate.year == this.props.endDate.year &&
            this.props.currentDate.endMonth == this.props.endDate.endMonth);
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
    render() {
        // https://react-component.github.io/slider/examples/slider.html
        return (
            <div style={{ width: 500 }} className="centerFixedWidth">
                <Slider min={0} max={this.mapDateToSliderIndex(this.props.endDate)} step={1} value={this.mapDateToSliderIndex(this.props.currentDate)} onChange={this.onSliderChange} />
                <div>
                    <Button onClick={() => this.clickStopPlayButton()}>{this.state.isPlaying ? "Stop" : "Play"}</Button>
                </div>
            </div>
        );
    }
}

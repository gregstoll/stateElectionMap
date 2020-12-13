extern crate csv;
extern crate json;
use serde::Deserialize;
use std::{collections::HashMap, fs::File, io::Write, path::{Path, PathBuf}};
use std::convert::TryFrom;
use std::fs;
use std::io::Error;

#[derive(Debug, Deserialize)]
struct ElectoralVoteEntry {
    state_code: String,
    electoral_votes: u8
}

#[derive(Debug, Deserialize)]
struct ElectionStateResultEntry {
    state_code: String,
    d_votes: u32,
    r_votes: u32,
    total_votes: u32
}

#[derive(Debug)]
struct ElectionStateResultMargin {
    state_code: String,
    d_margin: i32
}

const DATA_DIR : &str = r"C:\Users\greg\Documents\stateElectionMap\stateElectionMap\public\data";
type ElectoralVoteMap = HashMap<String, u8>;
type AllElectoralVotes = Vec<(u32, ElectoralVoteMap)>;
type ElectionResult = Vec<ElectionStateResultMargin>;
type AllElectionResults = Vec<(u32, ElectionResult)>;

fn main() {
    let entries = read_data().unwrap();
    let mut json_results = json::object! {};
    for election_result in entries.0 {
        let year = election_result.0;
        println!("Year {}", year);
        let electoral_votes = get_electoral_votes_for_year(&entries.1, year);
        let knapsack_inputs = create_knapsack_inputs(&election_result.1, electoral_votes);
        let total_electoral_votes: usize = electoral_votes.values().map(|val| *val as usize).sum();
        let necessary_electoral_votes: usize = match total_electoral_votes % 2 {
            0 => total_electoral_votes / 2,
            1 => (total_electoral_votes-1) / 2 + 1,
            _ => panic!()
        };
        let solution = solve_knapsack_problem(&knapsack_inputs.iter().map(|(item, _)| item.clone()).collect(), necessary_electoral_votes - 1).unwrap();
        let mut solution_index = 0;
        let mut min_states= vec![];
        for input_index in 0..knapsack_inputs.len() {
            if solution_index >= solution.len() || solution[solution_index] != input_index {
                // no match
                min_states.push(knapsack_inputs[input_index].1);
                println!("{:?}", knapsack_inputs[input_index]);
            }
            else {
                solution_index += 1;
            }
        }
        json_results[year.to_string()] =
            json::JsonValue::Array(min_states.iter().map(|&s| json::JsonValue::String(s.state_code.to_string())).collect());
    }
    let json_string = json::stringify_pretty(json_results, 4);
    println!("{}", json_string);
    let mut results_path = PathBuf::from(DATA_DIR);
    results_path.push("min_votes_to_change_result.json");
    let mut file = File::create(&results_path).unwrap();
    write!(&mut file, "{}", json_string).unwrap();
}

fn create_knapsack_inputs<'a>(election_result: &'a ElectionResult, electoral_votes: &'_ ElectoralVoteMap) -> Vec<(KnapsackItem, &'a ElectionStateResultMargin)> {
    // first, figure out who won.
    let mut d_votes: usize = 0;
    let mut r_votes: usize = 0;
    for margin in election_result {
        let ev = usize::from(*electoral_votes.get(&margin.state_code).unwrap());
        if margin.d_margin > 0 {
            d_votes += ev;
        }
        else {
            r_votes += ev;
        }
    }
    if d_votes == r_votes {
        panic!("Exact electoral tie??");
    }
    let d_won = d_votes > r_votes;
    let states_for_winner = election_result.iter().filter(|result| (result.d_margin > 0) == d_won);
    states_for_winner.map(|result|
         (KnapsackItem {
             weight: usize::from(*electoral_votes.get(&result.state_code).unwrap()),
             value: usize::try_from(result.d_margin.abs()).unwrap()
         }, result)
    ).collect()
}

fn get_electoral_votes_for_year(electoral_votes: &AllElectoralVotes, year: u32) -> &ElectoralVoteMap {
    if year < electoral_votes[0].0 {
        panic!("Year too early: {} is earlier than {}", year, electoral_votes[0].0);
    }
    for i in 1..electoral_votes.len() {
        if year < electoral_votes[i].0 {
            return &electoral_votes[i-1].1;
        }
    }
    return &electoral_votes[electoral_votes.len() - 1].1;
}

fn read_data() -> Result<(AllElectionResults, AllElectoralVotes), Error> {
    return Ok((read_all_election_results()?, read_all_electoral_votes()?));
}

#[derive(Debug, Eq, PartialEq, Clone)]
struct KnapsackItem {
    weight: usize,
    value: usize,
}

// Adapted from https://codereview.stackexchange.com/questions/188733/knapsack-0-1-in-rust
fn solve_knapsack_problem(items: &Vec<KnapsackItem>, max_weight: usize) -> Option<Vec<usize>> {
    let mut prev_row : Vec<(usize, Option<Vec<usize>>)> = Vec::new();
    let mut cur_row : Vec<(usize, Option<Vec<usize>>)> = Vec::new();
    for _ in 0..(max_weight + 1) {
        prev_row.push((0, None));
        cur_row.push((0, None));
    }

    for i in 0..items.len() {
        for j in 1..(max_weight + 1) {
            if items[i].weight > j {
                cur_row[j] = prev_row[j].clone();
            } else {
                let value_with_new_entry = prev_row[j-items[i].weight].0 + items[i].value;
                if value_with_new_entry > prev_row[j].0 {
                    let mut new_vec = prev_row[j-items[i].weight].1.clone().or(Some(vec![])).unwrap();
                    new_vec.push(i);
                    cur_row[j] = (value_with_new_entry, Some(new_vec));
                }
                else {
                    cur_row[j] = prev_row[j].clone();
                }
            }
        }
        prev_row = cur_row.clone();
    }
    cur_row.last().unwrap().1.clone()
}

fn read_all_electoral_votes() -> Result<AllElectoralVotes, Error> {
    let mut votes_path = PathBuf::from(DATA_DIR);
    votes_path.push("electoralVotes");
    let mut all_electoral_votes = AllElectoralVotes::new();
    for entry in fs::read_dir(votes_path)? {
        let entry = entry?;
        let entry_filename = entry.file_name().into_string().unwrap();
        if entry_filename.ends_with(".csv") {
            if let Ok(year) = entry_filename[0..4].parse::<u32>() {
                let contents = read_electoral_vote_file(&entry.path())?;
                let mut map = ElectoralVoteMap::new();
                for entry in &contents {
                    map.insert(entry.state_code.clone(), entry.electoral_votes);
                }
                all_electoral_votes.push((year, map));
            }
        }
    }
    Ok(all_electoral_votes)
}

fn read_all_election_results() -> Result<AllElectionResults, Error> {
    let mut results_path = PathBuf::from(DATA_DIR);
    results_path.push("electionResults");
    let mut all_election_results = AllElectionResults::new();
    for entry in fs::read_dir(results_path)? {
        let entry = entry?;
        let entry_filename = entry.file_name().into_string().unwrap();
        if entry_filename.ends_with(".csv") {
            if let Ok(year) = entry_filename[0..4].parse::<u32>() {
                let contents = read_election_result_file(&entry.path())?;
                all_election_results.push((year,
                    contents.iter().map(|r|
                        ElectionStateResultMargin {
                            state_code: r.state_code.clone(),
                            d_margin: i32::try_from(r.d_votes).unwrap() - i32::try_from(r.r_votes).unwrap()
                         }).collect()));
            }
        }
    }
    Ok(all_election_results)
}

fn read_electoral_vote_file(path: &Path) -> Result<Vec<ElectoralVoteEntry>, Error> {
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(false)
        .from_path(path)?;
    let mut result = Vec::new();
    // skip the header row
    for row in rdr.deserialize().skip(1) {
        let record : ElectoralVoteEntry = row?;
        result.push(record);
    }
    Ok(result)
}

fn read_election_result_file(path: &Path) -> Result<Vec<ElectionStateResultEntry>, Error> {
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(false)
        .from_path(path)?;
    let mut result = Vec::new();
    // skip the header row
    for row in rdr.deserialize().skip(1) {
        let record : ElectionStateResultEntry = row?;
        result.push(record);
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    #![allow(non_snake_case)]
    use super::*;

    #[test]
    fn test_knapsack_only_one_fits() {
        let items = vec![
            KnapsackItem {weight: 10, value: 20},
            KnapsackItem {weight: 4, value: 2},
            KnapsackItem {weight: 30, value: 100}];
        let solution = solve_knapsack_problem(&items, 9);
        assert_eq!(Some(vec![1]), solution);
    }

    #[test]
    fn test_knapsack_only_one_fits_and_its_first() {
        let items = vec![
            KnapsackItem {weight: 4, value: 2},
            KnapsackItem {weight: 10, value: 20},
            KnapsackItem {weight: 30, value: 100}];
        let solution = solve_knapsack_problem(&items, 9);
        assert_eq!(Some(vec![0]), solution);
    }

    #[test]
    fn test_knapsack_only_one_fits_and_its_last() {
        let items = vec![
            KnapsackItem {weight: 10, value: 20},
            KnapsackItem {weight: 30, value: 100},
            KnapsackItem {weight: 4, value: 2}];
        let solution = solve_knapsack_problem(&items, 9);
        assert_eq!(Some(vec![2]), solution);
    }

    #[test]
    fn test_knapsack_two_fit() {
        let items = vec![
            KnapsackItem {weight: 10, value: 20},
            KnapsackItem {weight: 10, value: 30},
            KnapsackItem {weight: 30, value: 100},
            KnapsackItem {weight: 4, value: 2}];
        let solution = solve_knapsack_problem(&items, 18);
        assert_eq!(Some(vec![1, 3]), solution);
    }

    #[test]
    fn test_knapsack_one_big_one_is_the_best() {
        let items = vec![
            KnapsackItem {weight: 10, value: 20},
            KnapsackItem {weight: 10, value: 30},
            KnapsackItem {weight: 30, value: 200},
            KnapsackItem {weight: 10, value: 50}];
        let solution = solve_knapsack_problem(&items, 30);
        assert_eq!(Some(vec![2]), solution);
    }

    #[test]
    fn test_knapsack_all_fit() {
        let items = vec![
            KnapsackItem {weight: 10, value: 20},
            KnapsackItem {weight: 10, value: 30},
            KnapsackItem {weight: 30, value: 200},
            KnapsackItem {weight: 10, value: 50}];
        let solution = solve_knapsack_problem(&items, 100);
        assert_eq!(Some(vec![0, 1, 2, 3]), solution);
    }

    #[test]
    fn test_knapsack_none_fit() {
        let items = vec![
            KnapsackItem {weight: 10, value: 20},
            KnapsackItem {weight: 10, value: 30},
            KnapsackItem {weight: 30, value: 200},
            KnapsackItem {weight: 10, value: 50}];
        let solution = solve_knapsack_problem(&items, 9);
        assert_eq!(None, solution);
    }

    #[test]
    fn test_electoral_votes_for_year() {
        let data = read_data().unwrap();
        let knownTXValues  = [(1972, 26), (1976, 26), (1980, 26), (1984, 29), (1988, 29), (1992, 32), (1996, 32), (2000, 32), (2004, 34), (2008, 34), (2012, 38), (2016, 38), (2020, 38)];
        for (year, knownTXValue) in knownTXValues.iter() {
            assert_eq!((year, knownTXValue), (year, get_electoral_votes_for_year(&data.1, *year).get("TX").unwrap()));
        }
    }
}
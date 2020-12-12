extern crate csv;
use serde::Deserialize;
use std::{collections::HashMap, path::{Path, PathBuf}};
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
    /*println!("Got {:?} result entries", entries.0.len());
    println!("Got {:?} ev entries", entries.1.len());*/
    for election_result in entries.0 {
        let year = election_result.0;
        println!("Year {}", year);
        let electoral_votes = get_electoral_votes_for_year(&entries.1, year);
        create_knapsack_inputs(&election_result.1, electoral_votes);
    }
}

fn create_knapsack_inputs(election_result: &ElectionResult, electoral_votes: &ElectoralVoteMap) {
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
    println!("d: {} r: {}", d_votes, r_votes);
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
fn solve_knapsack_problem(items: &Vec<KnapsackItem>, max_weight: usize) -> Vec<&KnapsackItem> {
    let mut prev_row : Vec<(usize, Vec<&KnapsackItem>)> = Vec::new();
    let mut cur_row : Vec<(usize, Vec<&KnapsackItem>)> = Vec::new();
    for _ in 0..(max_weight + 1) {
        prev_row.push((0, Vec::new()));
        cur_row.push((0, Vec::new()));
    }

    for i in 0..items.len() {
        for j in 1..(max_weight + 1) {
            if items[i].weight > j {
                cur_row[j] = prev_row[j].clone();
            } else {
                let value_with_new_entry = prev_row[j-items[i].weight].0 + items[i].value;
                if value_with_new_entry > prev_row[j].0 {
                    let mut new_vec = prev_row[j-items[i].weight].1.clone();
                    new_vec.push(&items[i]);
                    cur_row[j] = (value_with_new_entry, new_vec);
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
        assert_eq!(vec![&items[1]], solution);
    }

    #[test]
    fn test_knapsack_only_one_fits_and_its_first() {
        let items = vec![
            KnapsackItem {weight: 4, value: 2},
            KnapsackItem {weight: 10, value: 20},
            KnapsackItem {weight: 30, value: 100}];
        let solution = solve_knapsack_problem(&items, 9);
        assert_eq!(vec![&items[0]], solution);
    }

    #[test]
    fn test_knapsack_only_one_fits_and_its_last() {
        let items = vec![
            KnapsackItem {weight: 10, value: 20},
            KnapsackItem {weight: 30, value: 100},
            KnapsackItem {weight: 4, value: 2}];
        let solution = solve_knapsack_problem(&items, 9);
        assert_eq!(vec![&items[2]], solution);
    }

    #[test]
    fn test_knapsack_two_fit() {
        let items = vec![
            KnapsackItem {weight: 10, value: 20},
            KnapsackItem {weight: 10, value: 30},
            KnapsackItem {weight: 30, value: 100},
            KnapsackItem {weight: 4, value: 2}];
        let solution = solve_knapsack_problem(&items, 18);
        assert_eq!(vec![&items[1], &items[3]], solution);
    }

    #[test]
    fn test_knapsack_one_big_one_is_the_best() {
        let items = vec![
            KnapsackItem {weight: 10, value: 20},
            KnapsackItem {weight: 10, value: 30},
            KnapsackItem {weight: 30, value: 200},
            KnapsackItem {weight: 10, value: 50}];
        let solution = solve_knapsack_problem(&items, 30);
        assert_eq!(vec![&items[2]], solution);
    }

    #[test]
    fn test_knapsack_all_fit() {
        let items = vec![
            KnapsackItem {weight: 10, value: 20},
            KnapsackItem {weight: 10, value: 30},
            KnapsackItem {weight: 30, value: 200},
            KnapsackItem {weight: 10, value: 50}];
        let solution = solve_knapsack_problem(&items, 100);
        assert_eq!(vec![&items[0], &items[1], &items[2], &items[3]], solution);
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
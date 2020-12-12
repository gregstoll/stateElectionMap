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
    let data = read_data();
    match data {
        Ok(entries) => {
            println!("Got {:?} ev entries", entries.0.len());
            println!("Got {:?} result entries", entries.1.len());
            println!("{:?}", entries.0[6]);
        },
        Err(e) => println!("ERROR: {:?}", e),
    }
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
}
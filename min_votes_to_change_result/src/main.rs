extern crate csv;
use serde::Deserialize;
use std::{collections::HashMap, path::{Path, PathBuf}};
use std::fs;
use std::io::Error;

#[derive(Debug, Deserialize)]
struct ElectoralVoteEntry {
    state: String,
    electoral_votes: u8
}

const DATA_DIR : &str = r"C:\Users\greg\Documents\stateElectionMap\stateElectionMap\public\data";
type ElectoralVoteMap = HashMap<String, u8>;
type AllElectoralVotes = Vec<(u32, ElectoralVoteMap)>;

fn main() {
    let all_electoral_votes = read_all_electoral_votes();
    match all_electoral_votes {
        Ok(entries) => {
            println!("Got {:?} entries", entries.len());
            for entry in entries {
                println!("{:?}", entry);
            }
        },
        Err(e) => println!("ERROR: {:?}", e),
    }
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
                    map.insert(entry.state.clone(), entry.electoral_votes);
                }
                all_electoral_votes.push((year, map));
            }
        }
    }
    Ok(all_electoral_votes)
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

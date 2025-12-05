from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = PROJECT_ROOT / "web" / "data" / "spotify_songs.csv"
OUTPUT_DIR = PROJECT_ROOT / "output_tables"
WEB_DATA_DIR = PROJECT_ROOT / "web" / "data"


def load_dataset(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found at {path.resolve()}")
    return pd.read_csv(path)


def extract_release_year(dates: pd.Series) -> pd.Series:
    release_dates = pd.to_datetime(dates, errors="coerce", utc=True)
    return release_dates.dt.year


def q1_genre_volume_listener_appeal(df: pd.DataFrame) -> pd.DataFrame:
    return (
        df.groupby("playlist_genre", dropna=False)
        .agg(
            track_count=("track_id", "count"),
            avg_popularity=("track_popularity", "mean"),
        )
        .reset_index()
        .sort_values("playlist_genre")
    )


def _corr_energy_danceability(group: pd.DataFrame) -> float:
    if (
        group["energy"].nunique() < 2
        or group["danceability"].nunique() < 2
    ):
        return np.nan
    return group["energy"].corr(group["danceability"])


def q2_energy_danceability_corr(df: pd.DataFrame) -> pd.DataFrame:
    correlations = (
        df.groupby("playlist_genre", dropna=False)[["energy", "danceability"]]
        .apply(_corr_energy_danceability)
        .rename("corr_energy_danceability")
        .reset_index()
        .sort_values("playlist_genre")
    )
    return correlations


def q3_valence_tempo_popularity(df: pd.DataFrame) -> pd.DataFrame:
    normalized_df = df.copy()
    for feature in ("valence", "tempo"):
        normalized_df[f"{feature}_normalized"] = (
            normalized_df[feature] - normalized_df[feature].mean()
        ) / normalized_df[feature].std(ddof=0)

    correlations = {
        "valence": normalized_df["valence_normalized"].corr(
            normalized_df["track_popularity"]
        ),
        "tempo": normalized_df["tempo_normalized"].corr(
            normalized_df["track_popularity"]
        ),
    }
    return (
        pd.Series(correlations, name="correlation_with_popularity")
        .rename_axis("feature")
        .reset_index()
    )


def q4_acoustic_instrumental_by_genre_type(df: pd.DataFrame) -> pd.DataFrame:
    release_year = extract_release_year(df["track_album_release_date"])
    genre_year = df.assign(release_year=release_year).dropna(
        subset=["playlist_genre", "release_year"]
    )

    overall_median_year = genre_year["release_year"].median()
    genre_median_year = (
        genre_year.groupby("playlist_genre")["release_year"].median().to_dict()
    )

    def classify_genre(genre: str) -> str:
        if pd.isna(genre):
            return "Unknown"
        median_year = genre_median_year.get(genre)
        if median_year is None or np.isnan(median_year):
            return "Unknown"
        return "Modern" if median_year >= overall_median_year else "Traditional"

    genre_type_df = df.copy()
    genre_type_df["genre_type"] = genre_type_df["playlist_genre"].apply(classify_genre)

    return (
        genre_type_df.groupby("genre_type", dropna=False)[
            ["acousticness", "instrumentalness"]
        ]
        .mean()
        .rename(
            columns={
                "acousticness": "acousticness_mean",
                "instrumentalness": "instrumentalness_mean",
            }
        )
        .reset_index()
        .sort_values("genre_type")
    )


def q5_evolution_energy_tempo(df: pd.DataFrame) -> pd.DataFrame:
    years = extract_release_year(df["track_album_release_date"])

    yearly = (
        df.assign(year=years)
        .dropna(subset=["year"])
        .groupby("year")[["tempo", "energy"]]
        .mean()
        .rename(columns={"tempo": "avg_tempo", "energy": "avg_energy"})
        .reset_index()
        .sort_values("year")
    )
    return yearly


def q6_hit_vs_non_hit(df: pd.DataFrame) -> pd.DataFrame:
    threshold = df["track_popularity"].quantile(0.9)
    labeled = df.assign(
        hit_label=np.where(
            df["track_popularity"] >= threshold,
            "Hit",
            "Non-Hit",
        )
    )
    features = ["energy", "danceability", "valence", "tempo", "acousticness"]

    return (
        labeled.groupby("hit_label")[features]
        .mean()
        .reset_index()
        .rename(columns={"hit_label": "hit"})
        .sort_values("hit", ascending=False)
    )


def q7_feature_diversity(df: pd.DataFrame) -> pd.DataFrame:
    features = ["energy", "danceability", "valence", "tempo", "acousticness"]
    normalized = df.copy()

    for feature in features:
        col = normalized[feature]
        normalized[f"{feature}_normalized"] = (
            col - col.min()
        ) / (col.max() - col.min())

    feature_std = (
        normalized.groupby("playlist_genre", dropna=False)[
            [f"{feature}_normalized" for feature in features]
        ]
        .std()
        .mean(axis=1)
        .rename("feature_diversity")
        .reset_index()
        .sort_values("playlist_genre")
    )
    return feature_std


TRANSFORM_FUNCTIONS = {
    "q1_genre_volume_listener_appeal": q1_genre_volume_listener_appeal,
    "q2_energy_danceability_corr": q2_energy_danceability_corr,
    "q3_valence_tempo_popularity": q3_valence_tempo_popularity,
    "q4_acoustic_instrumental_by_genre_type": q4_acoustic_instrumental_by_genre_type,
    "q5_evolution_energy_tempo": q5_evolution_energy_tempo,
    "q6_hit_vs_non_hit": q6_hit_vs_non_hit,
    "q7_feature_diversity": q7_feature_diversity,
}


def main() -> None:
    df = load_dataset(DATA_PATH)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    WEB_DATA_DIR.mkdir(parents=True, exist_ok=True)

    for name, func in TRANSFORM_FUNCTIONS.items():
        result = func(df)
        filename = f"{name}.csv"
        result.to_csv(OUTPUT_DIR / filename, index=False)
        result.to_csv(WEB_DATA_DIR / filename, index=False)


if __name__ == "__main__":
    main()


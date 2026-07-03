"""Base class for all format encoders."""
from __future__ import annotations


class Encoder:
    """Abstract base encoder.

    Subclasses must set `name` and implement `encode`.
    """

    name: str  # e.g. "json_pretty", "toon", "vigesimal_v1"

    def encode(self, dataset_name: str, data: list | dict) -> str:
        """Encode *data* into a string representation.

        Args:
            dataset_name: The name of the dataset (e.g. "employee_records").
            data: Either a list of dicts (tabular) or a plain dict (config).

        Returns:
            The encoded string.
        """
        raise NotImplementedError(f"{self.__class__.__name__} must implement encode()")

    def format_name(self) -> str:
        """Return the human-readable encoder name."""
        return self.name

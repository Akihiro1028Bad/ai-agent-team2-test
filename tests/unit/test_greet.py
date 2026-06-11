import pytest
from app import greet


def test_greet_empty_string():
    assert greet("") == "Hello, guest!"


def test_greet_none():
    assert greet(None) == "Hello, guest!"


def test_greet_normal_name():
    assert greet("alice") == "Hello, Alice!"


def test_greet_already_capitalized():
    assert greet("Bob") == "Hello, Bob!"


def test_greet_single_char():
    assert greet("a") == "Hello, A!"

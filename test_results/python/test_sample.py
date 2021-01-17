# -*- coding: utf-8 -*-


def test_which_succeeds():
    event = { 'attr': 'test'}
    assert event['attr'] == 'test'

def test_which_fails():
    event = { 'attr': 'test'}
    assert event['attr'] == 'xyz'

def test_with_error():
    event = { 'attr': 'test'}
    assert event.attr == 'test'

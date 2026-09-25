package com.tensura_kubejs.kubejs.callback;

@FunctionalInterface
public interface NumberCallback<T> {
    double get(T context);
}

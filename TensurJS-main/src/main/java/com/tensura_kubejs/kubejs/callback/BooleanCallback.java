package com.tensura_kubejs.kubejs.callback;

@FunctionalInterface
public interface BooleanCallback<T> {
    boolean test(T context);
}

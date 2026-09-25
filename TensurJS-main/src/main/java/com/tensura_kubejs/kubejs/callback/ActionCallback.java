package com.tensura_kubejs.kubejs.callback;

@FunctionalInterface
public interface ActionCallback<T> {
    void run(T context);
}

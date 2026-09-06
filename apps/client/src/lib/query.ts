import { useCallback, useEffect, useRef, useState } from 'react'

type QueryKey = readonly unknown[]
type QueryOptions<T> = {
  queryKey: QueryKey
  queryFn: () => Promise<T> | T
  enabled?: boolean
  initialData?: T
}
type MutationOptions<TData, TVariables, TContext = unknown> = {
  mutationFn: (variables: TVariables) => Promise<TData> | TData
  onMutate?: (variables: TVariables) => Promise<TContext> | TContext
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void | Promise<void>
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void | Promise<void>
}

type QueryEntry = {
  data?: unknown
  error?: Error
  updatedAt: number
  listeners: Set<() => void>
  queryFn?: () => Promise<unknown> | unknown
  fetching?: Promise<void>
}

const STALE_TIME = 1000 * 60 * 5
const cache = new Map<string, QueryEntry>()

const keyHash = (key: QueryKey) => JSON.stringify(key)
const getEntry = (key: QueryKey) => {
  const hash = keyHash(key)
  let entry = cache.get(hash)
  if (!entry) {
    entry = { updatedAt: 0, listeners: new Set() }
    cache.set(hash, entry)
  }
  return entry
}
const notify = (entry: QueryEntry) => entry.listeners.forEach((listener) => listener())
const matches = (key: QueryKey, prefix: QueryKey) => prefix.every((part, index) => JSON.stringify(key[index]) === JSON.stringify(part))

const fetchEntry = async (entry: QueryEntry) => {
  if (!entry.queryFn) return
  if (entry.fetching) return entry.fetching
  entry.fetching = Promise.resolve(entry.queryFn())
    .then((data) => {
      entry.data = data
      entry.error = undefined
      entry.updatedAt = Date.now()
      notify(entry)
    })
    .catch((error: unknown) => {
      entry.error = error instanceof Error ? error : new Error(String(error))
      entry.updatedAt = 0
      notify(entry)
      throw entry.error
    })
    .finally(() => {
      entry.fetching = undefined
      notify(entry)
    })
  return entry.fetching
}

export function useApiQuery<T>({ queryKey, queryFn, enabled = true, initialData }: QueryOptions<T>) {
  const hash = keyHash(queryKey)
  const [, forceRender] = useState(0)
  const entry = getEntry(queryKey)
  entry.queryFn = queryFn

  if (entry.data === undefined && initialData !== undefined) {
    entry.data = initialData
    entry.updatedAt = Date.now()
  }

  useEffect(() => {
    const current = getEntry(queryKey)
    const listener = () => forceRender((value) => value + 1)
    current.listeners.add(listener)
    current.queryFn = queryFn
    if (enabled && current.data === undefined) void fetchEntry(current).catch(() => {})
    else if (enabled && Date.now() - current.updatedAt > STALE_TIME) void fetchEntry(current).catch(() => {})
    return () => {
      current.listeners.delete(listener)
    }
  }, [hash, enabled, queryFn])

  const refetch = useCallback(async () => {
    const current = getEntry(queryKey)
    current.queryFn = queryFn
    await fetchEntry(current)
    return { data: current.data as T }
  }, [hash, queryFn])

  return {
    data: entry.data as T | undefined,
    error: entry.error,
    isLoading: enabled && entry.data === undefined && !entry.error,
    isFetching: Boolean(entry.fetching),
    isError: Boolean(entry.error),
    refetch,
  }
}

export function useApiMutation<TData, TVariables, TContext = unknown>(options: MutationOptions<TData, TVariables, TContext>) {
  const optionsRef = useRef(options)
  optionsRef.current = options
  const [state, setState] = useState<{ isPending: boolean; data?: TData; error?: Error }>({ isPending: false })

  const execute = useCallback(async (variables?: TVariables, callbacks?: Partial<MutationOptions<TData, TVariables, TContext>>) => {
    setState({ isPending: true })
    const current = optionsRef.current
    let context: TContext | undefined
    try {
      context = current.onMutate ? await current.onMutate(variables as TVariables) : undefined
      const data = await current.mutationFn(variables as TVariables)
      await current.onSuccess?.(data, variables as TVariables, context)
      await callbacks?.onSuccess?.(data, variables as TVariables, context)
      setState({ isPending: false, data })
      return data
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause))
      await current.onError?.(error, variables as TVariables, context)
      await callbacks?.onError?.(error, variables as TVariables, context)
      setState({ isPending: false, error })
      throw error
    }
  }, [])

  return {
    ...state,
    mutate: (variables?: TVariables, callbacks?: Partial<MutationOptions<TData, TVariables, TContext>>) => {
      void execute(variables, callbacks).catch(() => {})
    },
    mutateAsync: execute,
  }
}

export function useApiCache() {
  return {
    invalidateQueries: async ({ queryKey }: { queryKey: QueryKey }) => {
      const entries = [...cache.entries()]
      await Promise.all(entries.map(async ([hash, entry]) => {
        const key = JSON.parse(hash) as QueryKey
        if (!matches(key, queryKey)) return
        entry.updatedAt = 0
        notify(entry)
        if (entry.listeners.size > 0) await fetchEntry(entry).catch(() => {})
      }))
    },
    cancelQueries: async (_options?: { queryKey?: QueryKey }) => undefined,
    setQueryData: <T>(queryKey: QueryKey, updater: T | ((previous: T | undefined) => T | undefined)) => {
      const entry = getEntry(queryKey)
      entry.data = typeof updater === 'function' ? (updater as (previous: T | undefined) => T | undefined)(entry.data as T | undefined) : updater
      entry.updatedAt = Date.now()
      notify(entry)
    },
    setQueriesData: <T>(options: { queryKey: QueryKey }, updater: (previous: T | undefined) => T | undefined) => {
      for (const [hash, entry] of cache.entries()) {
        const key = JSON.parse(hash) as QueryKey
        if (matches(key, options.queryKey)) {
          entry.data = updater(entry.data as T | undefined)
          entry.updatedAt = Date.now()
          notify(entry)
        }
      }
    },
  }
}

export const useQuery = useApiQuery
export const useMutation = useApiMutation
export const useQueryClient = useApiCache

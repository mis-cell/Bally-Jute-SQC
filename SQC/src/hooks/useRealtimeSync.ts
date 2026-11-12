import { useState, useEffect } from 'react';
import { postgresService, RealtimeSyncState } from '../services/postgresService';

export function useRealtimeData<T>(fetcher: () => T): T {
  const [data, setData] = useState<T>(fetcher);

  useEffect(() => {
    // Initial fetch
    setData(fetcher());

    const handleSyncEvent = () => {
      setData(fetcher());
    };

    window.addEventListener('bj_sqc_data_synced', handleSyncEvent);
    window.addEventListener('storage', handleSyncEvent);

    return () => {
      window.removeEventListener('bj_sqc_data_synced', handleSyncEvent);
      window.removeEventListener('storage', handleSyncEvent);
    };
  }, []);

  return data;
}

export function usePostgresSyncState(): RealtimeSyncState {
  const [state, setState] = useState<RealtimeSyncState>(() => postgresService.getSyncState());

  useEffect(() => {
    const unsub = postgresService.subscribeRealtimeSync((newState) => {
      setState(newState);
    });
    return unsub;
  }, []);

  return state;
}

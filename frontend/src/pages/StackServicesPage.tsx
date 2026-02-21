import { useEffect, useState } from 'react';
import { api, csrfHeaders } from '../api/client';
import { useAuth } from '../contexts/auth';

type ServiceStatus = Record<string, { status: string; message: string; container: string }>;

export function StackServicesPage() {
  const [services, setServices] = useState<ServiceStatus>({});
  const csrf = useAuth((s) => s.csrfToken);

  const load = () => api.get('/integrations/status').then((r) => setServices(r.data));
  useEffect(load, []);

  const restart = async (name: string) => {
    await api.post(`/integrations/${name}/restart`, {}, { headers: csrfHeaders(csrf) });
    load();
  };

  return (
    <div className='panel'>
      <h1>RSPAMD / Redis / ClamAV</h1>
      <p>Container status and basic administration for your extended mail security stack.</p>
      <ul>
        {Object.entries(services).map(([name, value]) => (
          <li key={name} style={{ marginBottom: '1rem' }}>
            <strong>{name}</strong> ({value.container}) - <em>{value.status}</em>
            <br />
            <small>{value.message}</small>
            <br />
            <button onClick={() => restart(name)}>Restart</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

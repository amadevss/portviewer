import { PortDashboard } from '@/components/port-dashboard';
import PortViewerServiceWorker from '@/components/PortViewerServiceWorker';

export default function Home() {
  return (
    <>
      <PortViewerServiceWorker />
      <PortDashboard />
    </>
  );
}

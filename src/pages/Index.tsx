import { AriaProvider } from '@/contexts/AriaContext';
import { AriaLayout } from '@/components/aria/AriaLayout';

const Index = () => (
  <AriaProvider>
    <AriaLayout />
  </AriaProvider>
);

export default Index;
